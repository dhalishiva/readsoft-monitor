import { supabase } from './supabase';

async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  // Edge Function returned a non-2xx status — try to read the real error from the response body
  if (error) {
    let detailMsg = error.message;
    try {
      // FunctionsHttpError includes a Response we can read
      if (error.context && typeof error.context.json === 'function') {
        const errBody = await error.context.json();
        if (errBody?.error) detailMsg = errBody.error;
      }
    } catch {
      // If we can't parse, fall back to the generic message
    }
    throw new Error(detailMsg);
  }

  if (data && data.success === false) throw new Error(data.error || 'Function failed');
  return data;
}

export const regenerateToken = (mailbox_id) =>
  callFunction('regenerate-token', { mailbox_id });

export const testSmtp = (test_recipient) =>
  callFunction('test-smtp', { test_recipient });

export const inviteAdmin = (email, full_name) =>
  callFunction('invite-admin', { email, full_name });

export const validateMailbox = (tenant_id, client_id, refresh_token) =>
  callFunction('validate-mailbox', { tenant_id, client_id, refresh_token });