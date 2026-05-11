// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, otp, new_password } = await req.json();
    if (!email || !otp || !new_password) {
      return jsonResponse({ success: false, error: 'email, otp, and new_password required' }, 400);
    }
    if (typeof new_password !== 'string' || new_password.length < 6) {
      return jsonResponse({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the most recent unused, non-expired OTP for this email
    const { data: otpRow } = await adminClient
      .from('password_reset_otps')
      .select('*')
      .eq('email', email.toLowerCase())
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!otpRow) {
      return jsonResponse({ success: false, error: 'Invalid or expired code' }, 400);
    }

    // Limit attempts to 5 per OTP
    if (otpRow.attempts >= 5) {
      // Mark used so it can't be retried further
      await adminClient.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otpRow.id);
      return jsonResponse({ success: false, error: 'Too many attempts. Request a new code.' }, 400);
    }

    // Verify the OTP
    const submittedHash = await sha256(otp);
    if (submittedHash !== otpRow.otp_hash) {
      // Increment attempts
      await adminClient.from('password_reset_otps').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id);
      return jsonResponse({ success: false, error: 'Invalid or expired code' }, 400);
    }

    // OTP valid. Look up the auth user by email.
    // We use admin.listUsers to find them — there's no direct email lookup.
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw new Error(`User lookup failed: ${listErr.message}`);

    const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
      // Mark OTP used to prevent reuse
      await adminClient.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otpRow.id);
      return jsonResponse({ success: false, error: 'Account not found' }, 400);
    }

    // Update password
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password: new_password,
    });
    if (updateErr) throw new Error(`Password update failed: ${updateErr.message}`);

    // Mark OTP as used
    await adminClient.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otpRow.id);

    // Also invalidate any other unused OTPs for this email (defense in depth)
    await adminClient.from('password_reset_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
      .is('used_at', null);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message }, 500);
  }
});