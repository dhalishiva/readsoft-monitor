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

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateOtp(): string {
  // 6-digit numeric code
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // This endpoint is callable WITHOUT a session (user is logged out).
  // To prevent abuse, we throttle and silently succeed even if the email isn't registered.
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return jsonResponse({ success: false, error: 'email required' }, 400);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Always respond with success (don't reveal whether the email exists)
    const respondSuccess = () => jsonResponse({ success: true });

    // Throttle: max 3 OTP requests per email per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from('password_reset_otps')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .gte('created_at', fifteenMinAgo);
    if ((count ?? 0) >= 3) {
      // Silently succeed — don't tell the caller they're rate-limited
      return respondSuccess();
    }

    // Look up the admin (any approved + active admin can reset)
    const { data: admin } = await adminClient
      .from('admins')
      .select('id, email, full_name, is_active, approval_status')
      .ilike('email', email)
      .single();

    if (!admin || !admin.is_active || admin.approval_status !== 'approved') {
      // Silently succeed
      return respondSuccess();
    }

    // Generate OTP, hash, store
    const otp = generateOtp();
    const otpHash = await sha256(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error: insertErr } = await adminClient.from('password_reset_otps').insert({
      email: email.toLowerCase(),
      otp_hash: otpHash,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    // Send email via SMTP
    const { data: smtp } = await adminClient.from('smtp_config').select('*').eq('id', 1).single();
    if (!smtp) {
      // SMTP not configured — can't send. Return success anyway (don't leak this info)
      return respondSuccess();
    }

    const transportConfig: any = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    };
    if (smtp.username && smtp.password) {
      transportConfig.auth = { user: smtp.username, pass: smtp.password };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Password Reset Code</h2>
          <p style="margin: 4px 0 0 0; opacity: 0.9;">ReadSoft Monitor</p>
        </div>
        <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${admin.full_name || 'there'},</p>
          <p>Use the following code to reset your ReadSoft Monitor password:</p>
          <div style="background: white; border: 2px solid #4f46e5; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
            <div style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">
              ${otp}
            </div>
          </div>
          <p style="color: #64748b; font-size: 13px;">This code expires in 10 minutes. If you didn't request a password reset, you can ignore this email.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"${smtp.from_name}" <${smtp.from_email}>`,
        to: admin.email,
        subject: 'Your ReadSoft Monitor password reset code',
        html,
      });
    } catch (e) {
      // Log but don't expose
      console.error('SMTP send failed:', (e as Error).message);
    }

    return respondSuccess();
  } catch (err) {
    // Even on errors, don't leak details
    console.error('request-password-reset error:', (err as Error).message);
    return jsonResponse({ success: true });
  }
});