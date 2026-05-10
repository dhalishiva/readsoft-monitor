// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { ImapFlow } from 'npm:imapflow@1.0.164';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  alerts_enabled: boolean;
}

interface StaleEmail {
  subject: string;
  from: string;
  date: Date;
  ageMinutes: number;
}

// Exchange refresh token for access token (used for IMAP XOAUTH2 auth).
// We DO NOT save the new refresh token — read-only consumer of credentials.
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
    auth: {
      user: mb.email,
      accessToken,
    },
    logger: false,
  });

  const stale: StaleEmail[] = [];
  const cutoff = new Date(Date.now() - mb.stale_threshold_minutes * 60 * 1000);

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Fetch envelope info for messages older than cutoff
      // Using "BEFORE" search criterion — IMAP date-only, so we get a superset
      // and filter by exact time client-side
      const beforeDate = new Date(cutoff.getTime() + 24 * 60 * 60 * 1000); // +1 day to be safe
      const messages = client.fetch(
        { since: '01-Jan-2000', before: beforeDate.toUTCString().split(' ').slice(1, 4).join('-') },
        { envelope: true, internalDate: true }
      );

      for await (const msg of messages) {
        const date = msg.internalDate || (msg.envelope?.date ? new Date(msg.envelope.date) : null);
        if (!date) continue;

        const ageMs = Date.now() - new Date(date).getTime();
        const ageMinutes = Math.floor(ageMs / 60000);
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
    await client.logout().catch(() => {/* ignore */});
  }

  return stale;
}

function buildEmailHtml(mb: Mailbox, stale: StaleEmail[]): string {
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
        <p style="margin: 4px 0 0 0; opacity: 0.95;">ReadSoft Monitor — ${escapeHtml(mb.email)}</p>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>
          <strong>${stale.length}</strong> email${stale.length > 1 ? 's' : ''} in this mailbox
          ${stale.length > 1 ? 'have' : 'has'} been waiting longer than the
          <strong>${mb.stale_threshold_minutes}-minute</strong> threshold.
        </p>
        <p style="color: #64748b; font-size: 13px;">
          ReadSoft normally processes incoming mail and moves it out of Inbox.
          Stale mail typically means ReadSoft is not running, has stopped processing this mailbox,
          or is unable to authenticate.
        </p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th style="padding: 8px; text-align: left;">Subject</th>
              <th style="padding: 8px; text-align: left;">From</th>
              <th style="padding: 8px; text-align: left;">Age</th>
            </tr>
          </thead>
          <tbody>${sampleRows}</tbody>
        </table>
        ${remaining}
        <p style="margin-top: 24px; font-size: 12px; color: #64748b;">
          You will receive this alert at most once per ${mb.stale_threshold_minutes} minutes while stale mail remains.
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
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
    alerts_sent: 0,
    skipped_throttled: 0,
    skipped_no_recipients: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Load all enabled mailboxes
    const { data: mailboxes, error: mbErr } = await adminClient
      .from('mailboxes')
      .select('*')
      .eq('alerts_enabled', true);
    if (mbErr) throw new Error(`Mailbox query failed: ${mbErr.message}`);

    if (!mailboxes || mailboxes.length === 0) {
      return jsonResponse({ success: true, summary });
    }

    summary.checked = mailboxes.length;

    // Load SMTP config (lazy — only needed if we actually send)
    let smtp: SmtpConfig | null = null;
    let transporter: any = null;

    for (const mb of mailboxes as Mailbox[]) {
      const updates: any = {
        last_sync_at: new Date().toISOString(),
      };

      try {
        // Update status to syncing for visibility (optional — most polls will be quick)
        // Skipped to keep DB writes minimal

        // Step 1: get IMAP access token
        const accessToken = await getAccessToken(mb);

        // Step 2: connect and find stale emails
        const stale = await findStaleEmails(mb, accessToken);

        updates.unread_count = stale.length; // not strictly "unread" but the count of stale items
        updates.status = stale.length > 0 ? 'error' : 'active';
        updates.last_error = null;

        if (stale.length === 0) {
          // Not stale — clear any previous alert state
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        summary.stale_found++;

        // Throttle: don't re-alert within stale_threshold_minutes
        const lastAlert = mb.last_stale_alert_at ? new Date(mb.last_stale_alert_at).getTime() : 0;
        const minIntervalMs = mb.stale_threshold_minutes * 60 * 1000;
        if (Date.now() - lastAlert < minIntervalMs) {
          summary.skipped_throttled++;
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        // Get recipients
        const { data: recipients } = await adminClient
          .from('notification_recipients')
          .select('email')
          .eq('mailbox_id', mb.id);
        const emails = (recipients || []).map(r => r.email);

        if (emails.length === 0) {
          summary.skipped_no_recipients++;
          await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
          continue;
        }

        // Lazy-load SMTP and transporter on first send
        if (!smtp) {
          const { data } = await adminClient.from('smtp_config').select('*').eq('id', 1).single();
          if (!data) throw new Error('SMTP not configured');
          smtp = data;
          transporter = await buildTransporter(smtp);
        }

        const subject = `[ReadSoft Monitor] Stale mail in ${mb.email} (${stale.length} item${stale.length > 1 ? 's' : ''})`;

        await transporter.sendMail({
          from: `"${smtp.from_name}" <${smtp.from_email}>`,
          to: emails.join(','),
          subject,
          html: buildEmailHtml(mb, stale),
        });

        await adminClient.from('alert_history').insert({
          mailbox_id: mb.id,
          alert_type: 'stale_mail',
          recipients: emails,
          subject,
          success: true,
        });

        updates.last_stale_alert_at = new Date().toISOString();
        await adminClient.from('mailboxes').update(updates).eq('id', mb.id);
        summary.alerts_sent++;
      } catch (err) {
        const msg = (err as Error).message;
        summary.failed++;
        summary.errors.push(`${mb.email}: ${msg}`);

        await adminClient.from('mailboxes').update({
          last_sync_at: new Date().toISOString(),
          status: 'error',
          last_error: msg,
        }).eq('id', mb.id);

        await adminClient.from('alert_history').insert({
          mailbox_id: mb.id,
          alert_type: 'stale_mail',
          recipients: [],
          subject: 'check failed',
          success: false,
          error_message: msg,
        });
      }
    }

    return jsonResponse({ success: true, summary });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message, summary }, 500);
  }
});