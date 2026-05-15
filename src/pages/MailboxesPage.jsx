import { useEffect, useState } from 'react';
import {
  Plus, Mail, Bell, Key, Trash2,
  RefreshCw, CheckCircle, Edit2, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import Badge from '../components/Badge';
import TokenHealthBar from '../components/TokenHealthBar';
import AddMailboxModal from '../components/AddMailboxModal';
import RegenerateTokenModal from '../components/RegenerateTokenModal';
import AlertConfigModal from '../components/AlertConfigModal';

export default function MailboxesPage() {
  const { supabase } = useAuth();
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editFor, setEditFor]     = useState(null);
  const [regenFor, setRegenFor]   = useState(null);
  const [alertFor, setAlertFor]   = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mailboxes').select('*').order('created_at', { ascending: false });
    setMailboxes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remove this mailbox? This cannot be undone.')) return;
    await supabase.from('mailboxes').delete().eq('id', id);
    load();
  };

  const handleMarkRegenerated = async (id) => {
    if (!confirm('Mark token as regenerated? This resets the 90-day timer and stops alerts.')) return;
    await supabase.from('mailboxes').update({
      token_generated_at: new Date().toISOString(),
      trigger_completed: true,
      token_expires_at: null,
      token_expiry_type: 'auto',
    }).eq('id', id);
    load();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Mailboxes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Manage ReadSoft approval mailboxes and token health.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus size={16} /> Add Mailbox
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="animate-spin mx-auto mb-2" size={20} /> Loading...
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center">
          <Mail size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No mailboxes connected</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add your first mailbox to start monitoring.</p>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            Add Mailbox
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mailboxes.map(mb => (
            <div key={mb.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm">{mb.email}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{mb.client_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <Badge status={mb.status} />
              </div>

              {mb.last_error && (
                <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{mb.last_error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  ['Stale threshold', `${mb.stale_threshold_minutes} min`],
                  ['Last sync', mb.last_sync_at
                    ? new Date(mb.last_sync_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : '—'
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              <TokenHealthBar mailbox={mb} />

              <div className="flex gap-1 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setAlertFor(mb)}
                  className="flex-1 px-2 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Bell size={13} /> Alerts
                </button>
                <button onClick={() => setRegenFor(mb)}
                  className="flex-1 px-2 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs flex items-center justify-center gap-1.5">
                  <Key size={13} /> Regen
                </button>
                <button onClick={() => setEditFor(mb)}
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg"
                  title="Edit">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleMarkRegenerated(mb.id)}
                  className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"
                  title="Mark as regenerated">
                  <CheckCircle size={15} />
                </button>
                <button onClick={() => handleDelete(mb.id)}
                  className="px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                  title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddMailboxModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {editFor  && <AddMailboxModal existing={editFor} onClose={() => setEditFor(null)} onCreated={load} />}
      {regenFor && <RegenerateTokenModal mailbox={regenFor} onClose={() => setRegenFor(null)} onSuccess={load} />}
      {alertFor && <AlertConfigModal mailbox={alertFor} onClose={() => setAlertFor(null)} onSaved={load} />}
    </div>
  );
}