import { useEffect, useState } from 'react';
import {
  UserPlus, Shield, RefreshCw, CheckCircle, MessageSquare,
  Trash2, Eye, EyeOff, KeyRound, MoreVertical, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { createAdmin } from '../lib/edgeFunctions';
import { timeAgo, formatFull } from '../lib/dateUtils';
import ResetPasswordModal from '../components/ResetPasswordModal';

// ─── Mobile action sheet ───────────────────────────────────────────────────
function ActionSheet({ admin, isSuperAdmin, isSelf, onClose, onDisable, onDelete, onReset }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl p-4 pb-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4 truncate px-4">
          {admin.email}
        </p>
        <div className="space-y-1">
          {isSuperAdmin && (
            <button
              onClick={() => { onReset(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-medium"
            >
              <KeyRound size={18} /> Reset Password
            </button>
          )}
          {!isSelf && (
            <button
              onClick={() => { onDisable(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              <Shield size={18} /> {admin.is_active ? 'Disable Account' : 'Enable Account'}
            </button>
          )}
          {!isSelf && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
            >
              <Trash2 size={18} /> Delete Admin
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium mt-2"
          >
            <X size={18} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile admin card ─────────────────────────────────────────────────────
function AdminCard({ a, currentAdmin, isSuperAdmin, onToggleActive, onDelete, onResetPassword }) {
  const isSelf = a.id === currentAdmin?.id;
  const isTargetSuperAdmin = a.role === 'super_admin';
  const [sheetOpen, setSheetOpen] = useState(false);

  const canAct = !isTargetSuperAdmin && !isSelf;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Avatar + info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
            {a.email[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1.5 flex-wrap">
              <span className="truncate">{a.full_name || a.email}</span>
              {isSelf && (
                <span className="text-xs text-slate-400 font-normal shrink-0">(you)</span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.email}</div>
          </div>
        </div>

        {/* Three-dot menu — only shown if there's something to do */}
        {canAct ? (
          <button
            onClick={() => setSheetOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <MoreVertical size={18} />
          </button>
        ) : (
          <span className="text-xs text-slate-400 italic shrink-0 pt-2">
            {isTargetSuperAdmin ? 'Protected' : '—'}
          </span>
        )}
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Role badge */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          isTargetSuperAdmin
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}>
          {isTargetSuperAdmin && <Shield size={11} />}
          {a.role}
        </span>

        {/* Status badge */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          a.is_active
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {a.is_active ? 'Active' : 'Disabled'}
        </span>

        {/* Approved date */}
        {a.approved_at && (
          <span
            className="text-xs text-slate-400 dark:text-slate-500"
            title={formatFull(a.approved_at)}
          >
            Approved {timeAgo(a.approved_at)}
          </span>
        )}
      </div>

      {/* Action sheet (mobile bottom drawer) */}
      {sheetOpen && (
        <ActionSheet
          admin={a}
          isSuperAdmin={isSuperAdmin}
          isSelf={isSelf}
          onClose={() => setSheetOpen(false)}
          onDisable={() => onToggleActive(a)}
          onDelete={() => onDelete(a)}
          onReset={() => onResetPassword(a)}
        />
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function AdminsPage() {
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);

  // Direct create form
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '' });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admins').select('*').order('created_at', { ascending: false });
    setAdmins(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingAdmins = admins.filter(a => a.approval_status === 'pending');
  const approvedAdmins = admins.filter(a => a.approval_status === 'approved');

  const handleApprove = async (admin) => {
    const { error } = await supabase.from('admins').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: currentAdmin.id,
    }).eq('id', admin.id);
    if (error) alert(`Failed to approve: ${error.message}`);
    else load();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      await createAdmin(createForm.email, createForm.password, createForm.full_name);
      setCreateMsg({ type: 'success', text: `Account created for ${createForm.email}.` });
      setCreateForm({ full_name: '', email: '', password: '' });
      setShowCreatePassword(false);
      setTimeout(load, 800);
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (admin) => {
    if (admin.role === 'super_admin') return;
    const { error } = await supabase.from('admins')
      .update({ is_active: !admin.is_active }).eq('id', admin.id);
    if (error) alert(`Failed: ${error.message}`);
    else load();
  };

  const handleDelete = async (admin) => {
    if (admin.role === 'super_admin') return;
    if (admin.id === currentAdmin.id) { alert("You can't delete your own account."); return; }
    if (!confirm(`Permanently delete ${admin.email}?\n\nThis cannot be undone.`)) return;
    const { error } = await supabase.from('admins').delete().eq('id', admin.id);
    if (error) alert(`Failed: ${error.message}`);
    else load();
  };

  const updateCreate = field => e => setCreateForm({ ...createForm, [field]: e.target.value });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold mb-5 text-slate-900 dark:text-white">
        Admin Users
      </h1>

      {/* ── Pending Requests ── */}
      {pendingAdmins.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 md:p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2 text-sm md:text-base">
              <span className="text-lg">⏳</span> Pending Access Requests
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200 font-bold">
              {pendingAdmins.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingAdmins.map(a => (
              <div key={a.id}
                className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-amber-100 dark:border-amber-900/50"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0 text-sm">
                    {a.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white text-sm">{a.full_name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.email}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5"
                      title={formatFull(a.created_at)}>
                      Requested {timeAgo(a.created_at)}
                    </div>
                  </div>
                </div>

                {a.signup_reason && (
                  <div className="mb-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <MessageSquare size={14} className="shrink-0 mt-0.5 text-slate-400" />
                    <span className="break-words text-xs md:text-sm">{a.signup_reason}</span>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleDelete(a)}
                    className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleApprove(a)}
                    className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Direct Create ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 mb-5">
        <h2 className="font-semibold mb-1 flex items-center gap-2 text-slate-900 dark:text-white text-sm md:text-base">
          <UserPlus size={18} /> Create Admin Directly
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Skip the approval workflow. New admin is auto-approved and can sign in immediately.
          Share the password through a secure channel.
        </p>

        {/* Stack on mobile, 3-col on desktop */}
        <form onSubmit={handleCreate} className="flex flex-col md:grid md:grid-cols-3 gap-3">
          <input
            type="text" required placeholder="Full name"
            value={createForm.full_name} onChange={updateCreate('full_name')} disabled={creating}
            className="px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
          <input
            type="email" required placeholder="email@company.com"
            value={createForm.email} onChange={updateCreate('email')} disabled={creating}
            className="px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
          <div className="relative">
            <input
              type={showCreatePassword ? 'text' : 'password'} required minLength={6}
              placeholder="Password (min 6 chars)"
              value={createForm.password} onChange={updateCreate('password')} disabled={creating}
              className="w-full px-3 py-2.5 pr-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
            />
            <button
              type="button" onClick={() => setShowCreatePassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </form>

        <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-center gap-3 mt-3">
          {createMsg ? (
            <p className={`text-sm ${createMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {createMsg.text}
            </p>
          ) : <span />}
          <button
            onClick={handleCreate} disabled={creating}
            className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>

      {/* ── All Admins ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">
            All Admins ({approvedAdmins.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={20} /> Loading...
          </div>
        ) : approvedAdmins.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">No admins yet.</div>
        ) : (
          <>
            {/* ── MOBILE: card list ── */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {approvedAdmins.map(a => (
                <div key={a.id} className="p-4">
                  <AdminCard
                    a={a}
                    currentAdmin={currentAdmin}
                    isSuperAdmin={isSuperAdmin}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    onResetPassword={setResetTarget}
                  />
                </div>
              ))}
            </div>

            {/* ── DESKTOP: table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Email</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Approved</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {approvedAdmins.map(a => {
                    const isSelf = a.id === currentAdmin?.id;
                    const isTargetSuperAdmin = a.role === 'super_admin';
                    return (
                      <tr key={a.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                              {a.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white text-sm">
                                {a.full_name || a.email}
                                {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            isTargetSuperAdmin
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {isTargetSuperAdmin && <Shield size={12} />}
                            {a.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            a.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {a.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400"
                          title={a.approved_at ? formatFull(a.approved_at) : ''}>
                          {a.approved_at ? timeAgo(a.approved_at) : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isTargetSuperAdmin ? (
                            <span className="text-xs text-slate-400 italic">Protected</span>
                          ) : isSelf ? (
                            <span className="text-xs text-slate-400 italic">—</span>
                          ) : (
                            <div className="flex gap-3 justify-end items-center">
                              {isSuperAdmin && (
                                <button
                                  onClick={() => setResetTarget(a)}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                                >
                                  <KeyRound size={13} /> Reset
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleActive(a)}
                                className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                {a.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleDelete(a)}
                                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Reset password modal (desktop + mobile) */}
      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}