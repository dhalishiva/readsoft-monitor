// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  use_tls: boolean;
  from_email: string;
  from_name: string;
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

function buildEmailHtml(mailbox: any, daysUntilExpiry: number) {
  const urgencyColor = daysUntilExpiry <= 3 ? '#dc2626' : daysUntilExpiry <= 7 ? '#ea580c' : '#0891b2';
  const expiryNote = daysUntilExpiry < 0
    ? `<strong style="color: #dc2626;">EXPIRED ${Math.abs(daysUntilExpiry)} day(s) ago.</strong>`
    : `Expires in approximately <strong>${daysUntilExpiry} day(s)</strong>.`;

  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠ Token Expiry Reminder</h2>
        <p style="margin: 4px 0 0 0; opacity: 0.95;">ReadSoft Monitor</p>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>The OAuth refresh token for the following mailbox needs to be regenerated and updated in ReadSoft's backend config:</p>
        <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 140px;">Mailbox:</td><td style="padding: 8px 0;"><strong>${mailbox.email}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Status:</td><td style="padding: 8px 0;">${expiryNote}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Tenant:</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${mailbox.tenant_id}</td></tr>
        </table>
        <p style="margin-top: 24px;"><strong>Action required:</strong></p>
        <ol style="padding-left: 20px; line-height: 1.7;">
          <li>Open ReadSoft Monitor and click <strong>Regenerate</strong> on this mailbox</li>
          <li>Copy the new refresh token</li>
          <li>Paste it into ReadSoft's backend config file</li>
          <li>Edit the mailbox in ReadSoft Monitor and paste the new token there too</li>
        </ol>
        <p style="margin-top: 24px; font-size: 12px; color: #64748b;">
          You will keep receiving this reminder daily until the token is regenerated and the mailbox is updated.
        </p>
      </div>
    </div>
  `;
}

function calculateDaysUntilExpiry(mailbox: any): number {
  let expiryDate: Date;
  if (mailbox.token_expiry_type === 'manual' && mailbox.token_expires_at) {
    expiryDate = new Date(mailbox.token_expires_at);
  } else {
    const generated = new Date(mailbox.token_generated_at);
    expiryDate = new Date(generated.getTime() + 90 * 24 * 60 * 60 * 1000);
  }
  const ms = expiryDate.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // This function is invoked by pg_cron with a shared secret header for auth
  // (no user JWT — it's a system job)
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
    alerted: 0,
    skipped_no_recipients: 0,
    skipped_not_due: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Load SMTP config once
    const { data: smtp } = await adminClient
      .from('smtp_config').select('*').eq('id', 1).single();
    if (!smtp) {
      return jsonResponse({ success: false, error: 'SMTP not configured' }, 400);
    }

    // Find all mailboxes that need an alert
    const now = new Date().toISOString();
    const { data: mailboxes, error: mbErr } = await adminClient
      .from('mailboxes')
      .select('*')
      .eq('alerts_enabled', true)
      .eq('trigger_completed', false)
      .not('trigger_date', 'is', null)
      .lte('trigger_date', now);

    if (mbErr) throw new Error(`Mailbox query failed: ${mbErr.message}`);

    summary.checked = mailboxes?.length || 0;

    if (!mailboxes || mailboxes.length === 0) {
      return jsonResponse({ success: true, summary });
    }

    const transporter = await buildTransporter(smtp);

    for (const mb of mailboxes) {
      try {
        // Get recipients
        const { data: recipients } = await adminClient
          .from('notification_recipients')
          .select('email')
          .eq('mailbox_id', mb.id);

        const emails = (recipients || []).map(r => r.email);
        if (emails.length === 0) {
          summary.skipped_no_recipients++;
          continue;
        }

        const days = calculateDaysUntilExpiry(mb);
        const subject = days < 0
          ? `[FlowSentinel] EXPIRED: Refresh token for ${mb.email}`
          : `[FlowSentinel] Token expiry warning: ${mb.email} (${days}d remaining)`;

        await transporter.sendMail({
          from: `"${smtp.from_name}" <${smtp.from_email}>`,
          to: emails.join(','),
          subject,
          html: buildEmailHtml(mb, days),
        });

        await adminClient.from('alert_history').insert({
          mailbox_id: mb.id,
          alert_type: 'token_expiry',
          recipients: emails,
          subject,
          success: true,
        });

        summary.alerted++;
      } catch (err) {
        const msg = (err as Error).message;
        summary.failed++;
        summary.errors.push(`${mb.email}: ${msg}`);
        await adminClient.from('alert_history').insert({
          mailbox_id: mb.id,
          alert_type: 'token_expiry',
          recipients: [],
          subject: 'failed to send',
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