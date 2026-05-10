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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { test_recipient } = await req.json();
    if (!test_recipient) return jsonResponse({ success: false, error: 'test_recipient required' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ success: false, error: 'Not authenticated' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ success: false, error: 'Invalid session' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: adminRow } = await adminClient
      .from('admins').select('id, is_active').eq('id', user.id).single();
    if (!adminRow?.is_active) return jsonResponse({ success: false, error: 'Not authorized' }, 403);

    const { data: smtp } = await adminClient
      .from('smtp_config').select('*').eq('id', 1).single();
    if (!smtp) return jsonResponse({ success: false, error: 'SMTP not configured' }, 400);

    const transportConfig: any = {
      host: smtp.host,
      port: smtp.port,
      // Port 465 uses implicit TLS (secure: true). Port 587/25 uses STARTTLS (secure: false, nodemailer upgrades automatically).
      secure: smtp.port === 465,
      // For Office 365 we sometimes need this:
      requireTLS: smtp.port === 587,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    };

    if (smtp.username && smtp.password) {
      transportConfig.auth = { user: smtp.username, pass: smtp.password };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    try {
      await transporter.sendMail({
        from: `"${smtp.from_name}" <${smtp.from_email}>`,
        to: test_recipient,
        subject: 'ReadSoft Monitor - Test Email',
        html: `<h2>SMTP Test Successful</h2><p>If you received this, your SMTP configuration is working correctly.</p>`,
      });
    } catch (e) {
      return jsonResponse({ success: false, error: `Send failed: ${(e as Error).message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse(
      { success: false, error: `Unhandled: ${(err as Error).message}` },
      500
    );
  }
});