// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is an authenticated user on this tenant
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    // Verify caller is an active, approved super_admin
    const { data: admin, error: adminErr } = await adminClient
      .from('admins')
      .select('role, is_active, approval_status')
      .eq('id', user.id)
      .single();

    if (adminErr || !admin) {
      return json({ success: false, error: 'Admin record not found' }, 403);
    }

    if (!admin.is_active || admin.approval_status !== 'approved') {
      return json({ success: false, error: 'Only active super admins can update the license' }, 403);
    }

    const { expires_at, license_type, max_mailboxes } = await req.json();

    if (!expires_at) {
      return json({ success: false, error: 'expires_at is required' }, 400);
    }

    // Sanity check: must be a valid date
    if (Number.isNaN(new Date(expires_at).getTime())) {
      return json({ success: false, error: 'expires_at is not a valid date' }, 400);
    }

    const { error: upsertErr } = await adminClient
      .from('license_config')
      .upsert({
        id: 1,
        expires_at,
        license_type:  license_type  || 'standard',
        max_mailboxes: max_mailboxes || 5,
        updated_at:    new Date().toISOString(),
      });

    if (upsertErr) throw new Error(upsertErr.message);

    return json({ success: true });

  } catch (err) {
    console.error('update-license error:', (err as Error).message);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});