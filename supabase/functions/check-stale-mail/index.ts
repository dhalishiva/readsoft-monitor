// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { ImapFlow } from 'npm:imapflow@1.0.164';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONNECTION_ALERT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour between connection-failure alerts

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface SmtpConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  from_email: string;
  from_name: string;
}

interface Mailbox {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  tenant_id: string;
  client_id: string;
  refresh_token: string;
  stale_threshold_minutes: number;
  last_stale_alert_at: string | null;
  last_connection_alert_at: string | null;
  alerts_enabled: boolean;
}

interface StaleEmail {
  subject: string;
  from: string;
  date: Date;
  ageMinutes: number;
}

async function getAccessToken(mb: Mailbox): Promise<string> {
  const params = new URLSearchParams({
    client_id: mb.client_id,
    grant_type: 'refresh_token',
    refresh_token: mb.refresh_token,
    scope: 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${mb.tenant_id}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return data.access_token;
}

async function findStaleEmails(mb: Mailbox, accessToken: string): Promise<StaleEmail[]> {
  const client = new ImapFlow({
    host: mb.imap_host,
    port: mb.imap_port,
    secure: true,
    auth: { user: mb.email, accessToken },
    logger: false,
  });
  const stale: StaleEmail[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const cutoff = new Date(Date.now() - mb.stale_threshold_minutes * 60 * 1000);
      const beforeDate = new Date(cutoff.getTime() + 24 * 60 * 60 * 1000);
      const messages = client.fetch(
        { since: '01-Jan-2000', before: beforeDate.toUTCString().split(' ').slice(1, 4).join('-') },
        { envelope: true, internalDate: true }
      );
      for await (const msg of messages) {
        const date = msg.internalDate || (msg.envelope?.date ? new Date(msg.envelope.date) : null);
        if (!date) continue;
        const ageMinutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
        if (ageMinutes >= mb.stale_threshold_minutes) {
          stale.push({
            subject: msg.envelope?.subject || '(no subject)',
            from: msg.envelope?.from?.[0]?.address || '(unknown)',
            date: new Date(date),
            ageMinutes,
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return stale;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function buildStaleEmailHtml(mb: Mailbox, stale: StaleEmail[]): string {
  const sample = stale.slice(0, 5);
  const sampleRows = sample.map(s => `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(s.subject)}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${escapeHtml(s.from)}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #dc2626; white-space: nowrap;">${s.ageMinutes} min</td>
    </tr>
  `).join('');
  const remaining = stale.length > 5 ? `<p style="color: #64748b; font-size: 13px;">…and ${stale.length - 5} more.</p>` : '';
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠ Stale Mail Detected</h2>
        <p style="margin: 4px 0 0 0; opacity: 0.95;">FlowSentinel — ${escapeHtml(mb.email)}</p>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p><strong>${stale.length}</strong> email${stale.length > 1 ? 's' : ''} in this mailbox ${stale.length > 1 ? 'have' : 'has'} been waiting longer than the <strong>${mb.stale_threshold_minutes}-minute</strong> threshold.</p>
        <p style="color: #64748b; font-size: 13px;">ReadSoft normally processes incoming mail and moves it out of Inbox. Stale mail typically means ReadSoft is not running, has stopped processing this mailbox, or is unable to authenticate.</p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse; font-size: 13px;">
          <thead><tr style="background: #e2e8f0;"><th style="padding: 8px; text-align: left;">Subject</th><th style="padding: 8px; text-align: left;">From</th><th style="padding: 8px; text-align: left;">Age</th></tr></thead>
          <tbody>${sampleRows}</tbody>
        </table>
        ${remaining}
      </div>
    </div>
  `;
}

function buildConnectionFailureHtml(mb: Mailbox, errorMessage: string): string {
  const looksLikeAuth = /invalid_grant|AADSTS|AUTHENTICATE|unauthorized|expired/i.test(errorMessage);
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background: #b91c1c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠ Mailbox Connection Failed</h2>
        <p style="margin: 4px 0 0 0; opacity: 0.95;">FlowSentinel — ${escapeHtml(mb.email)}</p>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>FlowSentinel was unable to connect to this mailbox during its periodic check.</p>
        ${looksLikeAuth ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
            <strong>This looks like an authentication issue.</strong> The refresh token may have expired or been revoked.
            <br><br>
            <strong>Action:</strong> Open FlowSentinel, click <strong>Regenerate</strong> on this mailbox, then update both ReadSoft's backend config and this app's saved token with the new value.
          </div>
        ` : `
          <p style="color: #64748b; font-size: 13px;">This may be a transient network issue. The system will retry automatically every 5 minutes.</p>
        `}
        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-top: 16px;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Error details:</p>
          <code style="font-family: monospace; font-size: 12px; color: #1e293b; word-break: break-all;">${escapeHtml(errorMessage)}</code>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
          You will receive this alert at most once per hour while the connection remains broken.
        </p>
      </div>
    </div>
  `;
}

async function buildTransporter(smtp: SmtpConfig) {
  const config: any = {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port === 587,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  };
  if (smtp.username && smtp.password) {
    config.auth = { user: smtp.username, pass: smtp.password };
  }
  return nodemailer.createTransport(config);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const summary = {
    checked: 0,
    stale_found: 0,
    stale_alerts_sent: 0,
    connection_failures: 0,
    connection_alerts_sent: 0,
    skipped_throttled: 0,
    skipped_no_recipients: 0,
    errors: [] as string[],
  };

  try {
    const { data: mailboxes, error: mbErr } = await adminClient
      .from('mailboxes')
      .select('*')
      .eq('alerts_enabled', true);
    if (mbErr) throw new Error(`Mailbox query failed: ${mbErr.message}`);
    if (!mailboxes || mailboxes.length === 0) return jsonResponse({ success: true, summary });

    summary.checked = mailboxes.length;

    let smtp: SmtpConfig | null = null;
    let transporter: any = null;
    const ensureTransporter = async () => {
      if (transporter) return;
      const { data } = await adminClient.from('smtp_config').select('*').eq('id', 1).single();
      if (!data) throw new Error('SMTP not configured');
      smtp = data;
      transporter = await buildTransporter(smtp);
    };

    for (const mb of mailboxes as Mailbox[]) {
      const updates: any = { last_sync_at: new Date().toISOString() };

      try {
        const accessToken = await getAccessToken(mb);
        const stale = await findStaleEmails(mb, accessToken);

        updates.unread_count = stale.length;
        updates.status = stale.length > 0 ? 'error' : 'active';
        updates.last_error = null;

        if (stale.length === 0) {
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        summary.stale_found++;
        const lastAlert = mb.last_stale_alert_at ? new Date(mb.last_stale_alert_at).getTime() : 0;
        const minIntervalMs = mb.stale_threshold_minutes * 60 * 1000;
        if (Date.now() - lastAlert < minIntervalMs) {
          summary.skipped_throttled++;
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        const { data: recipients } = await adminClient
          .from('notification_recipients').select('email').eq('mailbox_id', mb.id);
        const emails = (recipients || []).map(r => r.email);
        if (emails.length === 0) {
          summary.skipped_no_recipients++;
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        await ensureTransporter();
        const subject = `[FlowSentinel] Stale mail in ${mb.email} (${stale.length} item${stale.length > 1 ? 's' : ''})`;
        await transporter.sendMail({
          from: `"${smtp!.from_name}" <${smtp!.from_email}>`,
          to: emails.join(','),
          subject,
          html: buildStaleEmailHtml(mb, stale),
        });
        await adminClient.from('alert_history').insert({
          mailbox_id: mb.id, alert_type: 'stale_mail', recipients: emails, subject, success: true,
        });
        updates.last_stale_alert_at = new Date().toISOString();
        await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
        summary.stale_alerts_sent++;
      } catch (err) {
        // Connection or authentication failure
        const msg = (err as Error).message;
        summary.connection_failures++;
        summary.errors.push(`${mb.email}: ${msg}`);

        updates.status = 'error';
        updates.last_error = msg;

        // Throttle connection alerts to once per hour
        const lastConnAlert = mb.last_connection_alert_at ? new Date(mb.last_connection_alert_at).getTime() : 0;
        const shouldAlert = Date.now() - lastConnAlert >= CONNECTION_ALERT_INTERVAL_MS;

        if (shouldAlert) {
          try {
            const { data: recipients } = await adminClient
              .from('notification_recipients').select('email').eq('mailbox_id', mb.id);
            const emails = (recipients || []).map(r => r.email);

            if (emails.length > 0) {
              await ensureTransporter();
              const subject = `[FlowSentinel] Connection failed: ${mb.email}`;
              await transporter.sendMail({
                from: `"${smtp!.from_name}" <${smtp!.from_email}>`,
                to: emails.join(','),
                subject,
                html: buildConnectionFailureHtml(mb, msg),
              });
              await adminClient.from('alert_history').insert({
                mailbox_id: mb.id,
                alert_type: 'stale_mail', // re-using existing enum value (or add a new one — see note)
                recipients: emails,
                subject,
                success: true,
              });
              updates.last_connection_alert_at = new Date().toISOString();
              summary.connection_alerts_sent++;
            }
          } catch (sendErr) {
            // Failed to send the failure-alert email — log and move on
            await adminClient.from('alert_history').insert({
              mailbox_id: mb.id,
              alert_type: 'stale_mail',
              recipients: [],
              subject: 'connection failure alert send failed',
              success: false,
              error_message: (sendErr as Error).message,
            });
          }
        } else {
          summary.skipped_throttled++;
        }

        await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
      }
    }

    return jsonResponse({ success: true, summary });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message, summary }, 500);
  }
});