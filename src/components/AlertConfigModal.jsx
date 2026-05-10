import { useState, useEffect } from 'react';
import { X, Bell, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AlertConfigModal({ mailbox, onClose, onSaved }) {
  const [enabled, setEnabled] = useState(mailbox.alerts_enabled);
  const [triggerDate, setTriggerDate] = useState(
    mailbox.trigger_date ? mailbox.trigger_date.slice(0, 16) : ''
  );
  const [threshold, setThreshold] = useState(mailbox.stale_threshold_minutes);
  const [recipients, setRecipients] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('notification_recipients')
      .select('*').eq('mailbox_id', mailbox.id)
      .then(({ data }) => setRecipients(data || []));
  }, [mailbox.id]);

  const addRecipient = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    const { data, error } = await supabase
      .from('notification_recipients')
      .insert({ mailbox_id: mailbox.id, email: newEmail })
      .select().single();
    if (!error) {
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
      const { error } = await supabase
        .from('mailboxes')
        .update({
          alerts_enabled: enabled,
          trigger_date: triggerDate ? new Date(triggerDate).toISOString() : null,
          trigger_completed: false, // re-arm alerts when trigger date changes
          stale_threshold_minutes: parseInt(threshold, 10),
        })
        .eq('id', mailbox.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell size={20} className="text-orange-500" />
            Alerts — {mailbox.email}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Alerts</p>
              <p className="text-xs text-slate-500">Master switch for both expiry and stale mail alerts.</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative h-7 w-12 rounded-full transition ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {enabled && (
            <>
              {/* Trigger date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Token Expiry — Notification Date</label>
                <input
                  type="datetime-local"
                  value={triggerDate}
                  onChange={(e) => setTriggerDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Daily reminder emails fire after this date until token is regenerated.</p>
              </div>

              {/* Stale threshold */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stale Mail Threshold (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Alert recipients if any email sits in this mailbox longer than this.</p>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notification Recipients</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                    placeholder="add email..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button onClick={addRecipient} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm">Add</button>
                </div>
                {recipients.length === 0 && (
                  <p className="text-sm italic text-slate-400">No recipients — alerts won't be sent.</p>
                )}
                <div className="space-y-1">
                  {recipients.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="text-sm">{r.email}</span>
                      <button onClick={() => removeRecipient(r.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
        </div>

        <div className="px-6 py-4 bg-slate-50 flex gap-2 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}