import { useState } from 'react';
import {
  User, Mail, Calendar, Shield, KeyRound,
  Save, Eye, EyeOff, RefreshCw, CheckCircle
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { timeAgo, formatFull } from '../lib/dateUtils';

export default function ProfilePage() {
  // ← supabase now comes from useAuth(), not from the old supabase.js
  const { admin, refreshAdmin, supabase } = useAuth();

  const [fullName, setFullName] = useState(admin?.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  const handleNameSave = async (e) => {
    e.preventDefault();
    setNameMsg(null);
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('admins').update({ full_name: fullName }).eq('id', admin.id);
      if (error) throw error;
      setNameMsg({ type: 'success', text: 'Name updated.' });
      await refreshAdmin();
    } catch (err) {
      setNameMsg({ type: 'error', text: err.message });
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: admin.email, password: currentPassword,
      });
      if (signInErr) {
        setPwdMsg({ type: 'error', text: 'Current password is incorrect.' });
        setChangingPassword(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

  if (!admin) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
        <User size={26} /> My Profile
      </h1>

      {/* Account info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h2 className="font-semibold mb-4 text-slate-900 dark:text-white">Account Information</h2>
        <div className="space-y-3">
          <InfoRow icon={Mail} label="Email" value={admin.email} />
          <InfoRow
            icon={Shield}
            label="Role"
            value={
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                admin.role === 'super_admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {admin.role === 'super_admin' && <Shield size={11} />}
                {admin.role}
              </span>
            }
          />
          <InfoRow
            icon={Calendar}
            label="Account Created"
            value={<span title={formatFull(admin.created_at)}>{timeAgo(admin.created_at)}</span>}
          />
          {admin.approved_at && (
            <InfoRow
              icon={CheckCircle}
              label="Approved"
              value={<span title={formatFull(admin.approved_at)}>{timeAgo(admin.approved_at)}</span>}
            />
          )}
        </div>
      </div>

      {/* Edit name */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h2 className="font-semibold mb-4 text-slate-900 dark:text-white">Display Name</h2>
        <form onSubmit={handleNameSave} className="flex gap-3">
          <input
            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            required placeholder="Your full name" disabled={savingName}
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button type="submit"
            disabled={savingName || fullName === admin.full_name}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Save size={16} /> {savingName ? 'Saving...' : 'Save'}
          </button>
        </form>
        {nameMsg && (
          <p className={`mt-3 text-sm ${nameMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {nameMsg.text}
          </p>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound size={18} /> Change Password
          </h2>
          <button type="button" onClick={() => setShowPasswords(s => !s)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">
            {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPasswords ? 'Hide' : 'Show'} passwords
          </button>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <PwdField label="Current Password" type={showPasswords ? 'text' : 'password'}
            value={currentPassword} onChange={setCurrentPassword} disabled={changingPassword} required />
          <PwdField label="New Password" type={showPasswords ? 'text' : 'password'}
            value={newPassword} onChange={setNewPassword} disabled={changingPassword} required minLength={6} />
          <PwdField label="Confirm New Password" type={showPasswords ? 'text' : 'password'}
            value={confirmPassword} onChange={setConfirmPassword} disabled={changingPassword} required minLength={6} />
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {pwdMsg.text}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {changingPassword
                ? <><RefreshCw className="animate-spin" size={16} /> Changing...</>
                : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon size={16} className="text-slate-400 shrink-0" />
      <span className="text-sm text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}</span>
      <span className="text-sm text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function PwdField({ label, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} {...rest}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
    </div>
  );
}