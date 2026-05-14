import { useEffect, useState } from 'react';
import {
  History, CheckCircle, XCircle, Mail, Key,
  AlertTriangle, RefreshCw, Wifi
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { timeAgo, formatFull } from '../lib/dateUtils';

export default function AlertHistoryPage() {
  // ← dynamic client from AuthContext, not hardcoded supabase.js
  const { supabase } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMailbox, setFilterMailbox] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const [alertsRes, mailboxesRes] = await Promise.all([
      supabase.from('alert_history')
        .select('*, mailboxes(email)')
        .order('sent_at', { ascending: false })
        .limit(200),
      supabase.from('mailboxes').select('id, email').order('email'),
    ]);
    setAlerts(alertsRes.data || []);
    setMailboxes(mailboxesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  const filtered = alerts.filter(a => {
    if (filterMailbox !== 'all' && a.mailbox_id !== filterMailbox) return false;
    if (filterType !== 'all' && a.alert_type !== filterType) return false;
    return true;
  });

  const typeIcons = {
    token_expiry:      Key,
    stale_mail:        Mail,
    token_regenerated: RefreshCw,
    connection_failure: Wifi,
  };

  const typeLabels = {
    token_expiry:       'Token Expiry',
    stale_mail:         'Stale Mail',
    token_regenerated:  'Token Regenerated',
    connection_failure: 'Connection Failure',
  };

  const typeColors = {
    token_expiry:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    stale_mail:         'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    token_regenerated:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    connection_failure: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History size={26} /> Alert History
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Last 200 alerts sent by the system. Auto-refreshes every 30 seconds.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Filter by Mailbox
          </label>
          <select
            value={filterMailbox}
            onChange={e => setFilterMailbox(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All mailboxes</option>
            {mailboxes.map(mb => (
              <option key={mb.id} value={mb.id}>{mb.email}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Filter by Type
          </label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All types</option>
            <option value="token_expiry">Token Expiry</option>
            <option value="stale_mail">Stale Mail</option>
            <option value="connection_failure">Connection Failure</option>
            <option value="token_regenerated">Token Regenerated</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={20} /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <History size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-slate-600 dark:text-slate-300 font-medium">No alerts yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {alerts.length === 0
                ? 'Alerts will appear here when the system sends them.'
                : 'No alerts match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(a => {
              const Icon = typeIcons[a.alert_type] || AlertTriangle;
              return (
                <div
                  key={a.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-start gap-3">
                    {/* Success / failure dot */}
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      a.success
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {a.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Type badge */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                          typeColors[a.alert_type] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          <Icon size={11} />
                          {typeLabels[a.alert_type] || a.alert_type}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {a.mailboxes?.email || '(deleted mailbox)'}
                        </span>
                      </div>

                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-1 break-words">
                        {a.subject}
                      </p>

                      {a.recipients && a.recipients.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          To: {a.recipients.join(', ')}
                        </p>
                      )}

                      {!a.success && a.error_message && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                          Error: {a.error_message}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className="text-xs text-slate-500 dark:text-slate-400"
                        title={formatFull(a.sent_at)}
                      >
                        {timeAgo(a.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}