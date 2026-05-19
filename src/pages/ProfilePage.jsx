import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  User, Mail, Calendar, Shield, KeyRound,
  Save, Eye, EyeOff, RefreshCw,
  Key, AlertTriangle, CheckCircle, X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { timeAgo, formatFull } from '../lib/dateUtils';
import { renewLicense } from '../lib/registry';
import { updateLicense } from '../lib/edgeFunctions';

export default function ProfilePage() {
  const { admin, refreshAdmin, supabase, tenant, updateTenantLicense } = useAuth();
  const location = useLocation();

  const [fullName, setFullName]     = useState(admin?.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg]       = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords]     = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  // ── Renewal modal state ───────────────────────────────────────────────────
  const [showRenew, setShowRenew]     = useState(false);
  const [renewKey, setRenewKey]       = useState('');
  const [renewing, setRenewing]       = useState(false);
  const [renewMsg, setRenewMsg]       = useState(null);

  // Auto-open the renewal modal when banner sends user here with #renew hash
  useEffect(() => {
    if (location.hash === '#renew') {
      setShowRenew(true);
      // Strip the hash so refreshing doesn't keep reopening it
      window.history.replaceState(null, '', location.pathname);
    }
  }, [location.hash, location.pathname]);

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
    } finally { setSavingName(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' }); return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return;
    }
    setChangingPassword(true);
    try {
      // Verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: admin.email, password: currentPassword,
      });
      if (signInErr) {
        setPwdMsg({ type: 'error', text: 'Current password is incorrect.' });
        setChangingPassword(false); return;
      }

      // Update password using REST directly to avoid triggering auth state change
      // supabase.auth.updateUser() fires USER_UPDATED which causes a page re-render
      // We use it but immediately show success before any state change propagates
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      // Show success immediately — do this before anything else can trigger
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

  // ── Renewal handler ───────────────────────────────────────────────────────
  // The renewal flow mirrors first-time activation, minus the parts that
  // already exist: we already have a tenant Supabase, an authenticated
  // super_admin session, and a company_code. So all we do here is:
  //   1. Ask the registry to validate the new key (same `validate-license`
  //      function used during activation; the registry will update its own
  //      tenants table with the new expiry).
  //   2. Call `update-license` on this tenant's Supabase to push the new
  //      expiry into license_config (the value the cron jobs read).
  //   3. Update the in-memory + localStorage tenant.license so the banner
  //      and the License card both reflect the new state immediately.
  // const handleRenew = async (e) => {
  //   e.preventDefault();
  //   setRenewMsg(null);

  //   const key = renewKey.trim();
  //   if (!key.toUpperCase().startsWith('FS')) {
  //     setRenewMsg({ type: 'error', text: 'Invalid license key format. Keys start with FS.' });
  //     return;
  //   }
  //   if (!tenant?.supabase_url || !tenant?.supabase_anon_key || !tenant?.company_code) {
  //     setRenewMsg({ type: 'error', text: 'Tenant data missing. Please sign out and back in.' });
  //     return;
  //   }

  //   setRenewing(true);
  //   try {
  //     // Step 1 — validate against registry (also updates registry-side tenant row)
  //     const result = await validateLicense(
  //       key,
  //       tenant.supabase_url,
  //       tenant.supabase_anon_key,
  //       tenant.company_name || '',
  //       admin.email,
  //       tenant.company_code,
  //     );

  //     // Step 2 — push new expiry into license_config on this tenant Supabase
  //     await updateLicense(
  //       supabase,
  //       result.expires_at,
  //       result.license_type,
  //       result.max_mailboxes,
  //     );

  //     // Step 3 — reflect new license in AuthContext + localStorage so the
  //     // banner clears and the License card refreshes immediately, no reload.
  //     updateTenantLicense({
  //       type:          result.license_type,
  //       expires_at:    result.expires_at,
  //       max_mailboxes: result.max_mailboxes,
  //     });

  //     setRenewMsg({ type: 'success', text: 'License renewed successfully.' });
  //     setRenewKey('');
  //     // Close shortly after so the user sees the success state
  //     setTimeout(() => { setShowRenew(false); setRenewMsg(null); }, 1500);
  //   } catch (err) {
  //     setRenewMsg({ type: 'error', text: err.message });
  //   } finally {
  //     setRenewing(false);
  //   }
  // };

  const handleRenew = async (e) => {
    e.preventDefault();
    setRenewMsg(null);

    const key = renewKey.trim();
    if (!key.toUpperCase().startsWith('FS')) {
      setRenewMsg({ type: 'error', text: 'Invalid license key format. Keys start with FS.' });
      return;
    }
    if (!tenant?.company_code) {
      setRenewMsg({ type: 'error', text: 'Tenant data missing. Please sign out and back in.' });
      return;
    }

    setRenewing(true);
    try {
      // Step 1 — validate new key + update registry (supersedes old license row)
      const result = await renewLicense(key, tenant.company_code);

      // Step 2 — push new expiry into license_config on this tenant Supabase
      await updateLicense(
        supabase,
        result.expires_at,
        result.license_type,
        result.max_mailboxes,
      );

      // Step 3 — update in-memory + localStorage so banner clears immediately
      updateTenantLicense({
        type:          result.license_type,
        expires_at:    result.expires_at,
        max_mailboxes: result.max_mailboxes,
      });

      setRenewMsg({ type: 'success', text: 'License renewed successfully.' });
      setRenewKey('');
      setTimeout(() => { setShowRenew(false); setRenewMsg(null); }, 1500);
    } catch (err) {
      setRenewMsg({ type: 'error', text: err.message });
    } finally {
      setRenewing(false);
    }
  };

  if (!admin) return null;

  const license     = tenant?.license;
  const expiresDate = license?.expires_at ? new Date(license.expires_at) : null;
  const daysLeft    = expiresDate
    ? Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const licenseExpired = daysLeft !== null && daysLeft < 0;
  const licenseUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const canRenew       = admin.role === 'super_admin';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
        <User size={26} /> My Profile
      </h1>

      {/* License info */}
      {license && (
        <div className={`rounded-xl border p-5 mb-6 ${
          licenseExpired
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : licenseUrgent
              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Key size={16} className={
                licenseExpired ? 'text-red-500' :
                licenseUrgent  ? 'text-amber-500' :
                                 'text-indigo-500'
              } />
              License
              {licenseExpired && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 ml-1">
                  <AlertTriangle size={12} /> Expired
                </span>
              )}
              {licenseUrgent && !licenseExpired && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 ml-1">
                  <AlertTriangle size={12} /> Expiring soon
                </span>
              )}
            </h2>
            {canRenew && (
              <button
                type="button"
                onClick={() => { setShowRenew(true); setRenewMsg(null); setRenewKey(''); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  licenseExpired
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : licenseUrgent
                      ? 'bg-amber-600 text-white hover:bg-amber-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                Renew license
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Plan', <span className="capitalize">{license.type || '—'}</span>],
              ['Mailboxes', license.max_mailboxes ?? '—'],
              ['Expires', expiresDate ? formatFull(license.expires_at).split(',')[0] : '—'],
              ['Days left',
                daysLeft !== null
                  ? <span className={
                      daysLeft < 0   ? 'text-red-600 dark:text-red-400 font-semibold' :
                      daysLeft <= 7  ? 'text-red-600 dark:text-red-400 font-semibold' :
                      daysLeft <= 30 ? 'text-amber-600 dark:text-amber-400 font-semibold' :
                      'text-emerald-600 dark:text-emerald-400'
                    }>{daysLeft < 0 ? `${Math.abs(daysLeft)} ago` : daysLeft}</span>
                  : '—'
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
          {licenseExpired && (
            <p className="text-xs text-red-700 dark:text-red-400 mt-3">
              Your license has expired and monitoring is paused. Enter a new license key to resume.
            </p>
          )}
          {licenseUrgent && !licenseExpired && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
              Your license expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}. Renew now to avoid interruption.
            </p>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Company code:{' '}
            <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
              {tenant?.company_code}
            </span>
          </p>
        </div>
      )}

      {/* Account info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h2 className="font-semibold mb-4 text-slate-900 dark:text-white">Account Information</h2>
        <div className="space-y-3">
          {[
            [Mail, 'Email', admin.email],
            [Shield, 'Role',
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                admin.role === 'super_admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {admin.role === 'super_admin' && <Shield size={11} />}
                {admin.role}
              </span>
            ],
            [Calendar, 'Member since',
              <span title={formatFull(admin.created_at)}>{timeAgo(admin.created_at)}</span>
            ],
          ].map(([Icon, label, value]) => (
            <div key={label} className="flex items-center gap-3 py-2">
              <Icon size={16} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-500 dark:text-slate-400 w-28 shrink-0">{label}</span>
              <span className="text-sm text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h2 className="font-semibold mb-4 text-slate-900 dark:text-white">Display Name</h2>
        <form onSubmit={handleNameSave} className="flex gap-3">
          <input
            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            required placeholder="Your full name" disabled={savingName}
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
          <button type="submit"
            disabled={savingName || fullName === admin.full_name}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm">
            <Save size={15} />{savingName ? 'Saving...' : 'Save'}
          </button>
        </form>
        {nameMsg && (
          <p className={`mt-3 text-sm flex items-center gap-1.5 ${nameMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {nameMsg.type === 'success' && <CheckCircle size={14} />}
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
            {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPasswords ? 'Hide' : 'Show'}
          </button>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <PwdField label="Current Password"
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword} onChange={setCurrentPassword}
            disabled={changingPassword} required />
          <PwdField label="New Password"
            type={showPasswords ? 'text' : 'password'}
            value={newPassword} onChange={setNewPassword}
            disabled={changingPassword} required minLength={6} />
          <PwdField label="Confirm New Password"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword} onChange={setConfirmPassword}
            disabled={changingPassword} required minLength={6} />

          {pwdMsg && (
            <div className={`text-sm flex items-center gap-2 px-3 py-2 rounded-lg ${
              pwdMsg.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            }`}>
              {pwdMsg.type === 'success' && <CheckCircle size={14} />}
              {pwdMsg.text}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm">
              {changingPassword
                ? <><RefreshCw className="animate-spin" size={14} />Changing...</>
                : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Renewal modal ── */}
      {showRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Key size={18} className="text-indigo-500" />
                Renew license
              </h3>
              <button
                type="button"
                onClick={() => { if (!renewing) { setShowRenew(false); setRenewMsg(null); setRenewKey(''); } }}
                disabled={renewing}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRenew} className="p-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter your new license key. We'll verify it and resume monitoring automatically.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New license key
                </label>
                <input
                  type="text"
                  value={renewKey}
                  onChange={e => setRenewKey(e.target.value)}
                  required
                  placeholder="FS.XXXX.XXXX.XXXX"
                  autoFocus
                  disabled={renewing}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm disabled:opacity-50"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Your new key was emailed to you after renewal.
                </p>
              </div>

              {renewMsg && (
                <div className={`text-sm flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  renewMsg.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {renewMsg.type === 'success' && <CheckCircle size={14} />}
                  <span>{renewMsg.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowRenew(false); setRenewMsg(null); setRenewKey(''); }}
                  disabled={renewing}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing || !renewKey.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {renewing
                    ? <><RefreshCw className="animate-spin" size={14} /> Renewing…</>
                    : 'Renew license'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PwdField({ label, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} {...rest}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm" />
    </div>
  );
}