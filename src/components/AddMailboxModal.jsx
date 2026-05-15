import { useState } from 'react';
import { X, Mail, Server, Database, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { validateMailbox } from '../lib/edgeFunctions';

export default function AddMailboxModal({ existing, onClose, onCreated }) {
  const { admin, supabase, tenant } = useAuth();
  const isEdit = !!existing;

  const [form, setForm] = useState({
    email:                   existing?.email || '',
    imap_host:               existing?.imap_host || 'outlook.office365.com',
    imap_port:               existing?.imap_port || 993,
    tenant_id:               existing?.tenant_id || '',
    client_id:               existing?.client_id || '',
    refresh_token:           '',
    stale_threshold_minutes: existing?.stale_threshold_minutes || 15,
  });
  const [recipients, setRecipients] = useState('');
  const [step, setStep]   = useState('idle'); // idle | checking | validating | saving
  const [error, setError] = useState('');

  const update = field => e => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── License limit check (create only) ──────────────────────────────────
    if (!isEdit) {
      setStep('checking');
      try {
        const maxMailboxes = tenant?.license?.max_mailboxes;
        if (maxMailboxes) {
          const { count, error: countErr } = await supabase
            .from('mailboxes')
            .select('*', { count: 'exact', head: true });
          if (!countErr && count >= maxMailboxes) {
            setError(
              `Your license allows a maximum of ${maxMailboxes} mailbox${maxMailboxes === 1 ? '' : 'es'}. ` +
              `Contact support to upgrade your plan.`
            );
            setStep('idle');
            return;
          }
        }
      } catch {
        // If license check fails, fall through and let them continue
      }
    }

    // ── Decide whether to validate credentials ──────────────────────────────
    const tokenChanged = form.refresh_token.trim().length > 0;
    const credsChanged =
      !isEdit ||
      tokenChanged ||
      form.tenant_id !== existing?.tenant_id ||
      form.client_id !== existing?.client_id;

    if (credsChanged) {
      if (!form.refresh_token.trim()) {
        setError('Please provide a refresh token to validate the changed credentials.');
        setStep('idle');
        return;
      }

      setStep('validating');
      try {
        // validate-mailbox returns { success: true } only.
        // We save form.refresh_token as-is so DB mirrors ReadSoft config exactly.
        await validateMailbox(form.tenant_id, form.client_id, form.refresh_token);
      } catch (err) {
        setError(`Microsoft rejected the credentials: ${err.message}`);
        setStep('idle');
        return;
      }
    }

    // ── Save ────────────────────────────────────────────────────────────────
    setStep('saving');
    try {
      if (isEdit) {
        const updates = {
          email:                   form.email,
          imap_host:               form.imap_host,
          imap_port:               parseInt(form.imap_port, 10),
          tenant_id:               form.tenant_id,
          client_id:               form.client_id,
          stale_threshold_minutes: parseInt(form.stale_threshold_minutes, 10),
        };
        if (credsChanged) {
          updates.refresh_token      = form.refresh_token;
          updates.token_generated_at = new Date().toISOString();
          updates.trigger_completed  = true;
          updates.token_expires_at   = null;
          updates.token_expiry_type  = 'auto';
          updates.status             = 'active';
          updates.last_error         = null;
        }
        const { error: mbErr } = await supabase
          .from('mailboxes').update(updates).eq('id', existing.id);
        if (mbErr) throw mbErr;
      } else {
        const { data: mb, error: mbErr } = await supabase
          .from('mailboxes')
          .insert({
            ...form,
            refresh_token:           form.refresh_token,
            imap_port:               parseInt(form.imap_port, 10),
            stale_threshold_minutes: parseInt(form.stale_threshold_minutes, 10),
            token_generated_at:      new Date().toISOString(),
            status:                  'active',
            created_by:              admin.id,
          })
          .select().single();
        if (mbErr) throw mbErr;

        const list = recipients
          .split(/[,\n]/).map(r => r.trim()).filter(r => r && r.includes('@'));
        if (list.length > 0) {
          const rows = list.map(email => ({ mailbox_id: mb.id, email }));
          const { error: rErr } = await supabase
            .from('notification_recipients').insert(rows);
          if (rErr) throw rErr;
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
      setStep('idle');
    }
  };

  const busy = step !== 'idle';

  const stepLabel = {
    checking:   'Checking license...',
    validating: 'Validating with Microsoft...',
    saving:     'Saving...',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center sticky top-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEdit ? `Edit Mailbox — ${existing.email}` : 'Connect New Mailbox'}
          </h3>
          <button onClick={onClose} disabled={busy}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 flex gap-2">
            <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 dark:text-indigo-300">
              {isEdit
                ? 'Leave Refresh Token blank to keep the existing one. Provide a new token only if you have updated ReadSoft\'s config with it.'
                : 'Token is validated with Microsoft, then stored exactly as entered. It must match what\'s in ReadSoft\'s config.'}
            </p>
          </div>

          <Field label="Mailbox Email" icon={Mail} type="email" required
            value={form.email} onChange={update('email')} disabled={busy} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="IMAP Host" icon={Server} required
              value={form.imap_host} onChange={update('imap_host')} disabled={busy} />
            <Field label="IMAP Port" type="number" required
              value={form.imap_port} onChange={update('imap_port')} disabled={busy} />
          </div>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2">
            OAuth Credentials
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tenant ID" icon={Database} required
              value={form.tenant_id} onChange={update('tenant_id')}
              placeholder="11223344-..." disabled={busy} />
            <Field label="Client ID" icon={Server} required
              value={form.client_id} onChange={update('client_id')}
              placeholder="a1b2c3d4-..." disabled={busy} />
          </div>

          <Field
            label={isEdit ? 'New Refresh Token (leave blank to keep existing)' : 'Refresh Token'}
            icon={Lock}
            required={!isEdit}
            value={form.refresh_token}
            onChange={update('refresh_token')}
            placeholder={isEdit ? 'Leave blank if not rotating' : 'Paste from Postman'}
            disabled={busy}
          />

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2">
            Alerts
          </p>

          <Field label="Stale Mail Threshold (minutes)" type="number" required
            value={form.stale_threshold_minutes}
            onChange={update('stale_threshold_minutes')} disabled={busy} />

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notification Recipients
              </label>
              <textarea
                value={recipients}
                onChange={e => setRecipients(e.target.value)}
                placeholder="apac-team@company.com, oncall@company.com"
                rows={2}
                disabled={busy}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">
                Comma or newline separated. Edit later from Alert Config.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} disabled={busy}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {busy
                ? <><RefreshCw size={14} className="animate-spin" />{stepLabel[step]}</>
                : isEdit ? 'Save Changes' : 'Connect Mailbox'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        )}
        <input
          {...rest}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50`}
        />
      </div>
    </div>
  );
}