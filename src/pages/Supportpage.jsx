import { useState, useEffect } from 'react';
import {
  Ticket, Send, RefreshCw, CheckCircle,
  Clock, AlertTriangle, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { submitTicket } from '../lib/registry';
import { timeAgo, formatFull } from '../lib/dateUtils';

const CATEGORIES = ['technical', 'billing', 'feature_request', 'other'];
const PRIORITIES  = ['low', 'medium', 'high', 'critical'];

const STATUS_COLORS = {
  open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const PRIORITY_COLORS = {
  low:      'text-slate-500',
  medium:   'text-amber-600 dark:text-amber-400',
  high:     'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

export default function SupportPage() {
  const { admin, supabase, tenant } = useAuth();
  const [view, setView]     = useState('list'); // list | new
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]   = useState('');

  const [form, setForm] = useState({
    subject:     '',
    category:    'technical',
    priority:    'medium',
    description: '',
  });

  const upd = field => e => setForm({ ...form, [field]: e.target.value });

  // Load tickets from registry
  const loadTickets = async () => {
  if (!tenant?.company_code) return
  setLoading(true)
  try {
    const res = await fetch(
      `${import.meta.env.VITE_REGISTRY_URL}/functions/v1/get-tickets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_REGISTRY_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_REGISTRY_ANON_KEY}`,
        },
        body: JSON.stringify({ company_code: tenant.company_code }),
      }
    )
    const data = await res.json()
    if (data.success) setTickets(data.tickets || [])
  } catch { /* silent */ }
  finally { setLoading(false) }
}

  useEffect(() => { loadTickets(); }, [tenant?.company_code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await submitTicket(
        tenant.company_code,
        admin.email,
        admin.full_name || admin.email,
        form.subject.trim(),
        form.description.trim(),
        form.priority,
        form.category,
      );
      setSubmitted(true);
      setForm({ subject: '', category: 'technical', priority: 'medium', description: '' });
      await loadTickets();
      setTimeout(() => {
        setSubmitted(false);
        setView('list');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ticket size={24} /> Support
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Raise a ticket and we'll get back to you within one business day.
          </p>
        </div>
        {view === 'list' ? (
          <button
            onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <MessageSquare size={15} /> New ticket
          </button>
        ) : (
          <button
            onClick={() => { setView('list'); setError(''); }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            ← Back
          </button>
        )}
      </div>

      {/* New ticket form */}
      {view === 'new' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Ticket submitted</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We'll respond within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <input
                  type="text" required
                  placeholder="Brief description of the issue"
                  value={form.subject} onChange={upd('subject')}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select value={form.category} onChange={upd('category')}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select value={form.priority} onChange={upd('priority')}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  required rows={5}
                  placeholder="Describe the issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
                  value={form.description} onChange={upd('description')}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {submitting
                    ? <><RefreshCw className="animate-spin" size={14} />Submitting...</>
                    : <><Send size={14} />Submit ticket</>
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Ticket list */}
      {view === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <RefreshCw className="animate-spin mx-auto mb-2 text-slate-400" size={20} />
              <p className="text-sm text-slate-500">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <Ticket size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No tickets yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create your first support ticket if you need help.
              </p>
            </div>
          ) : (
            tickets.map(t => (
              <div key={t.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                      {t.category.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0"
                    title={formatFull(t.created_at)}>
                    {timeAgo(t.created_at)}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                  {t.subject}
                </p>

                {/* Admin reply */}
                {t.admin_reply && (
                  <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CheckCircle size={12} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        FlowSentinel Support replied
                        {t.replied_at && (
                          <span className="font-normal text-indigo-500 ml-1">
                            · {timeAgo(t.replied_at)}
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {t.admin_reply}
                    </p>
                  </div>
                )}

                {/* Pending indicator */}
                {!t.admin_reply && t.status === 'open' && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                    <Clock size={12} />
                    Awaiting response — usually within one business day
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}