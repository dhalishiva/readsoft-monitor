import { supabase } from './supabase';

async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {};
  if (session) headers.Authorization = `Bearer ${session.access_token}`;

  const { data, error } = await supabase.functions.invoke(name, { body, headers });

  if (error) {
    let detailMsg = error.message;
    try {
      if (error.context && typeof error.context.json === 'function') {
        const errBody = await error.context.json();
        if (errBody?.error) detailMsg = errBody.error;
      }
    } catch {/* ignore */}
    throw new Error(detailMsg);
  }

  if (data && data.success === false) throw new Error(data.error || 'Function failed');
  return data;
}

export const regenerateToken = (mailbox_id) =>
  callFunction('regenerate-token', { mailbox_id });

export const testSmtp = (test_recipient) =>
  callFunction('test-smtp', { test_recipient });

export const validateMailbox = (tenant_id, client_id, refresh_token) =>
  callFunction('validate-mailbox', { tenant_id, client_id, refresh_token });

export const createAdmin = (email, password, full_name) =>
  callFunction('create-admin', { email, password, full_name });

export const requestPasswordReset = (email) =>
  callFunction('request-password-reset', { email });

export const verifyPasswordReset = (email, otp, new_password) =>
  callFunction('verify-password-reset', { email, otp, new_password });

export const resetOtherPassword = (target_admin_id, new_password) =>
  callFunction('reset-other-password', { target_admin_id, new_password });

export const deleteAdmin = (target_admin_id) =>
  callFunction('delete-admin', { target_admin_id });