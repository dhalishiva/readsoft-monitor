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
    const { mailbox_id } = await req.json();
    if (!mailbox_id) throw new Error('mailbox_id required');

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
      .from('admins').select('id, is_active').eq('id', user.id).single();
    if (!adminRow?.is_active) throw new Error('Not authorized');

    const { data: mailbox, error: mbErr } = await adminClient
      .from('mailboxes').select('*').eq('id', mailbox_id).single();
    if (mbErr || !mailbox) throw new Error('Mailbox not found');

    const params = new URLSearchParams({
      client_id: mailbox.client_id,
      grant_type: 'refresh_token',
      refresh_token: mailbox.refresh_token,
      scope: 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
    });

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${mailbox.tenant_id}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      await adminClient.from('token_regeneration_log').insert({
        mailbox_id,
        regenerated_by: user.id,
        success: false,
        error_message: tokenData.error_description || tokenData.error || 'Unknown error',
      });
      throw new Error(`Microsoft rejected request: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.refresh_token) {
      throw new Error('No refresh_token in Microsoft response');
    }

    // Log success — but DO NOT update the mailbox row.
    // The new token is shown to the admin and emailed to recipients.
    // Admin will manually paste it into ReadSoft, then into our Edit Mailbox form
    // (which is where the DB actually gets updated).
    await adminClient.from('token_regeneration_log').insert({
      mailbox_id,
      regenerated_by: user.id,
      success: true,
    });

    // TODO Stage 3: also email this token to mailbox's recipients via SMTP

    return new Response(
      JSON.stringify({
        success: true,
        new_refresh_token: tokenData.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});