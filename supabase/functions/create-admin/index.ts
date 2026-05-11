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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password || !full_name) {
      return jsonResponse({ success: false, error: 'email, password, and full_name are required' }, 400);
    }
    if (password.length < 6) {
      return jsonResponse({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }

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

    // Caller must be an active, approved admin (any role)
    const { data: caller } = await adminClient
      .from('admins').select('is_active, approval_status').eq('id', user.id).single();
    if (!caller?.is_active || caller.approval_status !== 'approved') {
      return jsonResponse({ success: false, error: 'Not authorized' }, 403);
    }

    // Create the auth user with auto_approve flag → handle_new_user trigger sees this
    // and creates the admins row already approved
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation since admin is vouching for them
      user_metadata: {
        full_name,
        auto_approve: true,
      },
    });

    if (error) return jsonResponse({ success: false, error: error.message }, 400);

    return jsonResponse({ success: true, user_id: data.user?.id });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message }, 500);
  }
});