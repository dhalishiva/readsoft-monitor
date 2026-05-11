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
    const { target_admin_id, new_password } = await req.json();
    if (!target_admin_id || !new_password) {
      return jsonResponse({ success: false, error: 'target_admin_id and new_password required' }, 400);
    }
    if (typeof new_password !== 'string' || new_password.length < 6) {
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

    // Caller must be active, approved super_admin
    const { data: caller } = await adminClient
      .from('admins').select('role, is_active, approval_status').eq('id', user.id).single();
    if (!caller?.is_active || caller.approval_status !== 'approved' || caller.role !== 'super_admin') {
      return jsonResponse({ success: false, error: 'Only super_admin can reset other admins\' passwords' }, 403);
    }

    // Don't allow super_admin to reset their own password through this endpoint (use Profile page)
    if (target_admin_id === user.id) {
      return jsonResponse({ success: false, error: 'Use Profile page to change your own password' }, 400);
    }

    // Verify the target exists and isn't a super_admin (can't reset super_admin)
    const { data: target } = await adminClient
      .from('admins').select('role, email').eq('id', target_admin_id).single();
    if (!target) return jsonResponse({ success: false, error: 'Target admin not found' }, 404);
    if (target.role === 'super_admin') {
      return jsonResponse({ success: false, error: 'Cannot reset super_admin password from this endpoint' }, 403);
    }

    // Update the password
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(target_admin_id, {
      password: new_password,
    });
    if (updateErr) throw new Error(`Password update failed: ${updateErr.message}`);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message }, 500);
  }
});