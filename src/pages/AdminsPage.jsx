import { useEffect, useState, useRef } from 'react';
import {
  UserPlus, Shield, RefreshCw, Trash2,
  MoreVertical, UserCheck, UserX, KeyRound, X, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { createAdmin, deleteAdmin, resetOtherPassword } from '../lib/edgeFunctions';

export default function AdminsPage() {
  const { admin: currentAdmin, supabase } = useAuth();
  const [admins, setAdmins]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [actionSheet, setActionSheet] = useState(null);
  const [createMode, setCreateMode]   = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [creating, setCreating]   = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState('');

  // Reset password modal
  const [resetFor, setResetFor]         = useState(null);
  const [resetPwd, setResetPwd]         = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting]       = useState(false);
  const [resetMsg, setResetMsg]         = useState(null);

  // Dropdown position tracking
  const rowRefs = useRef({});

  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admins').select('*').order('created_at', { ascending: true });
    setAdmins(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Check if a row is near the bottom of the viewport
  const shouldOpenUpward = (adminId) => {
    const el = rowRefs.current[adminId];
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.bottom > window.innerHeight - 180;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      await createAdmin(supabase, form.email, form.password, form.full_name);
      setCreateMsg({ type: 'success', text: `Account created for ${form.email}.` });
      setForm({ email: '', password: '', full_name: '' });
      setTimeout(load, 800);
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.message });
    } finally { setCreating(false); }
  };

  const handleToggleActive = async (admin) => {
    await supabase.from('admins').update({ is_active: !admin.is_active }).eq('id', admin.id);
    setActionSheet(null);
    load();
  };

  const handleApprove = async (admin) => {
    await supabase.from('admins').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: currentAdmin.id,
    }).eq('id', admin.id);
    setActionSheet(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAdmin(supabase, deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.message);
    } finally { setDeleting(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg(null);
    if (resetPwd !== resetConfirm) {
      setResetMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setResetting(true);
    try {
      await resetOtherPassword(supabase, resetFor.id, resetPwd);
      setResetMsg({ type: 'success', text: 'Password updated successfully.' });
      setResetPwd('');
      setResetConfirm('');
    } catch (err) {
      setResetMsg({ type: 'error', text: err.message });
    } finally { setResetting(false); }
  };

  const openActionSheet = (adminId) => {
    setActionSheet(actionSheet === adminId ? null : adminId);
  };

  const roleColor = (role) => role === 'super_admin'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  const statusColor = (a) => {
    if (a.approval_status === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (!a.is_active) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  };

  const statusLabel = (a) => {
    if (a.approval_status === 'pending') return 'Pending';
    if (!a.is_active) return 'Disabled';
    return 'Active';
  };

  const ActionMenu = ({ a }) => {
    const upward = shouldOpenUpward(a.id);
    return (
      <div className="relative inline-block" ref={el => rowRefs.current[a.id] = el}>
        <button
          onClick={() => openActionSheet(a.id)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <MoreVertical size={16} />
        </button>
        {actionSheet === a.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setActionSheet(null)} />
            <div className={`absolute right-0 z-20 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden ${
              upward ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}>
              {a.approval_status === 'pending' && (
                <button onClick={() => { handleApprove(a); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                  <UserCheck size={14} className="text-emerald-500" /> Approve
                </button>
              )}
              <button onClick={() => { handleToggleActive(a); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                {a.is_active
                  ? <><UserX size={14} className="text-amber-500" /> Disable account</>
                  : <><UserCheck size={14} className="text-emerald-500" /> Enable account</>
                }
              </button>
              <button onClick={() => { setResetFor(a); setActionSheet(null); setResetPwd(''); setResetMsg(null); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                <KeyRound size={14} className="text-indigo-500" /> Reset password
              </button>
              <button onClick={() => { setDeleteTarget(a); setActionSheet(null); setDeleteError(''); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                <Trash2 size={14} /> Delete user
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Admin Users</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{admins.length} users</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setCreateMode(v => !v); setCreateMsg(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            <UserPlus size={15} /> Create Admin
          </button>
        )}
      </div>

      {/* Create form */}
      {createMode && isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-5">
          <h2 className="font-semibold mb-4 text-slate-900 dark:text-white text-sm">Create Admin Directly</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full name</label>
                <input type="text" placeholder="Jane Smith"
                  value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email *</label>
                <input type="email" required placeholder="jane@company.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password *</label>
                <input type="password" required minLength={6} placeholder="min 6 chars"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
            {createMsg && (
              <p className={`text-sm ${createMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {createMsg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm">
                {creating ? 'Creating...' : 'Create account'}
              </button>
              <button type="button" onClick={() => { setCreateMode(false); setCreateMsg(null); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-visible">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="animate-spin mx-auto mb-2" size={20} /> Loading...
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 rounded-t-xl">
              <tr>
                {['User', 'Role', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {admins.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {a.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {a.full_name || a.email}
                          {a.id === currentAdmin?.id && (
                            <span className="ml-2 text-xs text-slate-400">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(a.role)}`}>
                      {a.role === 'super_admin' && <Shield size={10} />}
                      {a.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a)}`}>
                      {statusLabel(a)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isSuperAdmin && a.id !== currentAdmin?.id && (
                      <ActionMenu a={a} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
          </div>
        ) : admins.map(a => (
          <div key={a.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {a.email[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {a.full_name || a.email}
                    {a.id === currentAdmin?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleColor(a.role)}`}>
                  {a.role}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(a)}`}>
                  {statusLabel(a)}
                </span>
              </div>
            </div>
            {isSuperAdmin && a.id !== currentAdmin?.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                {a.approval_status === 'pending' && (
                  <button onClick={() => handleApprove(a)}
                    className="flex-1 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg">
                    Approve
                  </button>
                )}
                <button onClick={() => handleToggleActive(a)}
                  className="flex-1 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                  {a.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => { setResetFor(a); setResetPwd(''); setResetMsg(null); }}
                  className="flex-1 py-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg">
                  Reset pwd
                </button>
                <button onClick={() => { setDeleteTarget(a); setDeleteError(''); }}
                  className="flex-1 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-center mb-2">
              Delete user?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">
              This will permanently delete
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center mb-4">
              {deleteTarget.full_name || deleteTarget.email}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 text-center mb-5">
              This action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4 text-center">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                {deleting ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound size={16} className="text-indigo-500" /> Reset Password
              </h3>
              <button onClick={() => { setResetFor(null); setResetMsg(null); setResetPwd(''); setResetConfirm(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Set a new password for{' '}
              <strong className="text-slate-700 dark:text-slate-300">{resetFor.email}</strong>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">New password</label>
                <input
                  type="password" required minLength={6}
                  placeholder="Min 6 characters"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Confirm new password</label>
                <input
                  type="password" required minLength={6}
                  placeholder="Re-enter password"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 dark:text-white ${
                    resetConfirm && resetPwd !== resetConfirm
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {resetConfirm && resetPwd !== resetConfirm && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
              {resetMsg && (
                <p className={`text-sm ${resetMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {resetMsg.text}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setResetFor(null); setResetMsg(null); setResetPwd(''); setResetConfirm(''); }}
                  className="flex-1 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
                  Cancel
                </button>
                <button type="submit"
                  disabled={resetting || resetPwd.length < 6 || resetPwd !== resetConfirm}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {resetting ? 'Saving...' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}