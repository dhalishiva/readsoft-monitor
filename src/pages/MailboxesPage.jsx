import { useEffect, useState } from 'react';
import { Plus, Mail, Bell, Key, Trash2, RefreshCw, CheckCircle, Edit2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { timeAgo, formatFull } from '../lib/dateUtils';
import Badge from '../components/Badge';
import TokenHealthBar from '../components/TokenHealthBar';
import AddMailboxModal from '../components/AddMailboxModal';
import RegenerateTokenModal from '../components/RegenerateTokenModal';
import AlertConfigModal from '../components/AlertConfigModal';

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editFor, setEditFor] = useState(null);
  const [regenFor, setRegenFor] = useState(null);
  const [alertFor, setAlertFor] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mailboxes').select('*').order('created_at', { ascending: false });
    setMailboxes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remove this mailbox? This cannot be undone.')) return;
    await supabase.from('mailboxes').delete().eq('id', id);
    load();
  };

  const handleMarkRegenerated = async (id) => {
    if (!confirm(
      'Confirm that you have pasted the new refresh token into ReadSoft\'s backend config?\n\n' +
      'This resets the 90-day token timer and stops expiry alerts. ' +
      'Only click this AFTER updating ReadSoft.'
    )) return;
    await supabase.from('mailboxes').update({
      token_generated_at: new Date().toISOString(),
      trigger_completed: true,
      token_expires_at: null,
      token_expiry_type: 'auto',
    }).eq('id', id);
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mailboxes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your ReadSoft approval mailboxes and token health.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
          <Plus size={18} /> Add Mailbox
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="animate-spin mx-auto mb-2" size={20} /> Loading...
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center">
          <Mail size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No mailboxes connected</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add your first mailbox to start monitoring.</p>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Add Mailbox
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mailboxes.map(mb => (
            <div key={mb.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    mb.status === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                  }`}>
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate text-slate-900 dark:text-white">{mb.email}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{mb.client_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <Badge status={mb.status} />
              </div>

              {mb.status === 'error' && mb.last_error && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span className="break-words">{mb.last_error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Stale Threshold</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{mb.stale_threshold_minutes} min</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg" title={mb.last_sync_at ? formatFull(mb.last_sync_at) : ''}>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last Sync</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{timeAgo(mb.last_sync_at)}</p>
                </div>
              </div>

              {mb.unread_count > 0 && (
                <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                  <strong>{mb.unread_count}</strong> stale email{mb.unread_count > 1 ? 's' : ''} in inbox
                </div>
              )}

              <TokenHealthBar mailbox={mb} />

              <div className="flex gap-1 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setAlertFor(mb)} className="flex-1 px-2 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300" title="Configure alerts">
                  <Bell size={14} /> Alerts
                </button>
                <button onClick={() => setRegenFor(mb)} className="flex-1 px-2 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs flex items-center justify-center gap-1.5" title="Regenerate token via Microsoft">
                  <Key size={14} /> Regen
                </button>
                <button onClick={() => setEditFor(mb)} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400" title="Edit connection details">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleMarkRegenerated(mb.id)} className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg" title="Mark as regenerated in ReadSoft">
                  <CheckCircle size={16} />
                </button>
                <button onClick={() => handleDelete(mb.id)} className="px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 rounded-lg" title="Remove mailbox">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddMailboxModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {editFor && <AddMailboxModal existing={editFor} onClose={() => setEditFor(null)} onCreated={load} />}
      {regenFor && <RegenerateTokenModal mailbox={regenFor} onClose={() => setRegenFor(null)} onSuccess={load} />}
      {alertFor && <AlertConfigModal mailbox={alertFor} onClose={() => setAlertFor(null)} onSaved={load} />}
    </div>
  );
}