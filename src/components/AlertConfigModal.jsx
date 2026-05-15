import { useState, useEffect } from 'react';
import { X, Bell, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function AlertConfigModal({ mailbox, onClose, onSaved }) {
  const { supabase } = useAuth();

  const [enabled, setEnabled]     = useState(mailbox.alerts_enabled);
  const [triggerDate, setTriggerDate] = useState(
    mailbox.trigger_date ? mailbox.trigger_date.slice(0, 16) : ''
  );
  const [threshold, setThreshold] = useState(mailbox.stale_threshold_minutes);
  const [recipients, setRecipients] = useState([]);
  const [newEmail, setNewEmail]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  useEffect(() => {
    supabase
      .from('notification_recipients')
      .select('*')
      .eq('mailbox_id', mailbox.id)
      .then(({ data }) => {
        setRecipients(data || []);
        setLoadingRecipients(false);
      });
  }, [mailbox.id]);

  const addRecipient = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    const { data, error: rErr } = await supabase
      .from('notification_recipients')
      .insert({ mailbox_id: mailbox.id, email: newEmail })
      .select().single();
    if (!rErr && data) {
      setRecipients([...recipients, data]);
      setNewEmail('');
    }
  };

  const removeRecipient = async (id) => {
    await supabase.from('notification_recipients').delete().eq('id', id);
    setRecipients(recipients.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: saveErr } = await supabase
        .from('mailboxes')
        .update({
          alerts_enabled:          enabled,
          trigger_date:            triggerDate ? new Date(triggerDate).toISOString() : null,
          trigger_completed:       false,
          stale_threshold_minutes: parseInt(threshold, 10),
        })
        .eq('id', mailbox.id);
      if (saveErr) throw saveErr;
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center sticky top-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell size={18} className="text-orange-500" />
            Alerts — {mailbox.email}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white text-sm">Enable Alerts</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Master switch for both expiry and stale mail alerts.
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {enabled && (
            <>
              {/* Token expiry trigger date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Token Expiry — Notification Date
                </label>
                <input
                  type="datetime-local"
                  value={triggerDate}
                  onChange={e => setTriggerDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Daily reminder emails fire after this date until the token is regenerated.
                </p>
              </div>

              {/* Stale threshold */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Stale Mail Threshold (minutes)
                </label>
                <input
                  type="number" min="1"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Alert if any email sits in the inbox longer than this.
                </p>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Notification Recipients
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                    placeholder="add email..."
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addRecipient}
                    disabled={!newEmail || !newEmail.includes('@')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {loadingRecipients ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <RefreshCw size={13} className="animate-spin" /> Loading...
                  </div>
                ) : recipients.length === 0 ? (
                  <p className="text-sm italic text-slate-400 dark:text-slate-500">
                    No recipients — alerts won't be sent.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map(r => (
                      <div key={r.id}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{r.email}</span>
                        <button
                          onClick={() => removeRecipient(r.id)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex gap-2 justify-end rounded-b-2xl border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
            {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}