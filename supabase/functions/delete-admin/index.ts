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
    const { target_admin_id } = await req.json();
    if (!target_admin_id) {
      return jsonResponse({ success: false, error: 'target_admin_id required' }, 400);
    }

    // Verify caller is authenticated and active
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

    // Caller must be active + approved admin
    const { data: caller } = await adminClient
      .from('admins')
      .select('role, is_active, approval_status')
      .eq('id', user.id)
      .single();

    if (!caller?.is_active || caller.approval_status !== 'approved') {
      return jsonResponse({ success: false, error: 'Not authorized' }, 403);
    }

    // Target must not be super_admin
    const { data: target } = await adminClient
      .from('admins')
      .select('role, email, approval_status')
      .eq('id', target_admin_id)
      .single();

    if (!target) {
      return jsonResponse({ success: false, error: 'Target admin not found' }, 404);
    }
    if (target.role === 'super_admin') {
      return jsonResponse({ success: false, error: 'Cannot delete super_admin' }, 403);
    }
    if (target_admin_id === user.id) {
      return jsonResponse({ success: false, error: 'Cannot delete your own account' }, 400);
    }

    // Delete from public.admins first (FK constraint)
    const { error: adminDeleteErr } = await adminClient
      .from('admins')
      .delete()
      .eq('id', target_admin_id);

    if (adminDeleteErr) {
      throw new Error(`Failed to delete admin row: ${adminDeleteErr.message}`);
    }

    // Delete from auth.users (requires service-role)
    const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(target_admin_id);

    if (authDeleteErr) {
      // auth.users delete failed — this is non-fatal for the app but means
      // the email is still blocked for re-registration. Log and return partial success.
      console.error('auth.users delete failed:', authDeleteErr.message);
      return jsonResponse({
        success: true,
        warning: `Admin removed from app but auth cleanup failed: ${authDeleteErr.message}. Email may not be reusable immediately.`,
      });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message }, 500);
  }
});