// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenant_id, client_id, refresh_token } = await req.json();
    if (!tenant_id || !client_id || !refresh_token) {
      throw new Error('tenant_id, client_id, and refresh_token are required');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Invalid session');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: adminRow } = await adminClient
      .from('admins').select('is_active').eq('id', user.id).single();
    if (!adminRow?.is_active) throw new Error('Not authorized');

    // Validate by attempting refresh — but DISCARD the new token Microsoft returns.
    // The admin's stored token is the source of truth (it must match ReadSoft's config).
    const params = new URLSearchParams({
      client_id,
      grant_type: 'refresh_token',
      refresh_token,
      scope: 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
    });

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: tokenData.error_description || tokenData.error || 'Microsoft rejected the credentials',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No access_token in Microsoft response — check requested scopes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validation passed. We do NOT return tokenData.refresh_token — caller will
    // save the original token they provided.
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});