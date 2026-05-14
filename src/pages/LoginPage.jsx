import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, RefreshCw, KeyRound,
  Building2, ArrowRight, ArrowLeft, Shield
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { lookupTenant, validateLicense } from '../lib/registry';

const SCREEN = {
  COMPANY:  'company',
  LOGIN:    'login',
  ACTIVATE: 'activate',
};

export default function LoginPage() {
  const { signIn, initialiseTenant, registerTenant, supabase } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState(SCREEN.COMPANY);

  // Company code
  const [companyCode, setCompanyCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Login / forgot
  const [loginMode, setLoginMode] = useState('login'); // login | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState('email'); // email | verify
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Activate
  const [activateStep, setActivateStep] = useState('license');
  const [licenseKey, setLicenseKey] = useState('');
  const [activateSbUrl, setActivateSbUrl] = useState('');
  const [activateSbAnonKey, setActivateSbAnonKey] = useState('');
  const [activateCompanyName, setActivateCompanyName] = useState('');
  const [activateCompanyCode, setActivateCompanyCode] = useState('');
  const [activateEmail, setActivateEmail] = useState('');
  const [activatePassword, setActivatePassword] = useState('');
  const [activateName, setActivateName] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');

  // Skip company code screen if tenant already in localStorage
  useEffect(() => {
    if (supabase) setScreen(SCREEN.LOGIN);
  }, [supabase]);

  const reset = () => { setError(''); setInfo(''); };

  const switchMode = (mode) => {
    setLoginMode(mode); reset();
    setForgotStep('email'); setOtp(''); setNewPassword('');
  };

  // ── Company code lookup ────────────────────────────────────────────────────
  const handleCompanyLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    setLookingUp(true);
    try {
      const result = await lookupTenant(companyCode.trim().toUpperCase());
      initialiseTenant({
        company_name: result.company_name,
        company_code: result.company_code,
        supabase_url: result.supabase_url,
        supabase_anon_key: result.supabase_anon_key,
        license: result.license,
      });
      setScreen(SCREEN.LOGIN);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookingUp(false);
    }
  };

  // ── Sign in ────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError('Invalid email or password.');
    else navigate('/');
  };

  // ── Forgot: request OTP ────────────────────────────────────────────────────
  const handleForgotRequest = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const { requestPasswordReset } = await import('../lib/edgeFunctions');
      await requestPasswordReset(email);
    } catch { /* silent */ }
    setInfo('If an account exists for this email, a 6-digit code has been sent. Check your inbox.');
    setForgotStep('verify');
    setLoading(false);
  };

  // ── Forgot: verify OTP + new password ─────────────────────────────────────
  const handleForgotVerify = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const { verifyPasswordReset } = await import('../lib/edgeFunctions');
      await verifyPasswordReset(email, otp, newPassword);
      setLoginMode('login');
      setForgotStep('email'); setOtp(''); setNewPassword(''); setPassword('');
      setInfo('Password reset successfully. Sign in with your new password.');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  // ── Activate: step 1 ──────────────────────────────────────────────────────
  const handleLicenseStep = (e) => {
    e.preventDefault();
    setActivateError('');
    if (!licenseKey.trim().toUpperCase().startsWith('FS')) {
      setActivateError('Invalid license key format. Keys start with FS.');
      return;
    }
    setActivateStep('supabase');
  };

  // ── Activate: step 2 ──────────────────────────────────────────────────────
  const handleSupabaseStep = (e) => {
    e.preventDefault();
    setActivateError('');
    try { new URL(activateSbUrl); }
    catch { setActivateError('Please enter a valid Supabase URL (e.g. https://xxxx.supabase.co)'); return; }
    if (!activateSbAnonKey.startsWith('eyJ')) {
      setActivateError('Anon key should start with eyJ — check you copied the right key');
      return;
    }
    setActivateStep('account');
  };

  // ── Activate: step 3 ──────────────────────────────────────────────────────
  const handleActivate = async (e) => {
    e.preventDefault();
    setActivateError('');
    if (activateCompanyCode.length !== 4) {
      setActivateError('Company code must be exactly 4 characters');
      return;
    }
    setActivating(true);
    try {
      const result = await validateLicense(
        licenseKey.trim(),
        activateSbUrl.trim().replace(/\/$/, ''),
        activateSbAnonKey.trim(),
        activateCompanyName.trim(),
        activateEmail.trim(),
        activateCompanyCode.trim().toUpperCase(),
      );

      const tenantData = {
        company_name: result.company_name,
        company_code: result.company_code,
        supabase_url: activateSbUrl.trim().replace(/\/$/, ''),
        supabase_anon_key: activateSbAnonKey.trim(),
        license: {
          type: result.license_type,
          expires_at: result.expires_at,
          max_mailboxes: result.max_mailboxes,
        },
      };

      const { createClient } = await import('@supabase/supabase-js');
      const tenantClient = createClient(
        tenantData.supabase_url,
        tenantData.supabase_anon_key,
        { auth: { persistSession: true, storageKey: `fs_auth_${tenantData.supabase_url}` } }
      );

      const { error: signUpErr } = await tenantClient.auth.signUp({
        email: activateEmail.trim(),
        password: activatePassword,
        options: { data: { full_name: activateName.trim(), auto_approve: true } },
      });
      if (signUpErr) throw new Error(`Account creation failed: ${signUpErr.message}`);

      const { data: signInData, error: signInErr } =
        await tenantClient.auth.signInWithPassword({
          email: activateEmail.trim(),
          password: activatePassword,
        });
      if (signInErr) throw new Error(`Sign in failed: ${signInErr.message}`);
      if (!signInData.session) throw new Error('No session returned');

      localStorage.setItem('fs_tenant', JSON.stringify(tenantData));
      registerTenant(tenantData);
      await new Promise(r => setTimeout(r, 700));
      navigate('/');
    } catch (err) {
      setActivateError(err.message);
      localStorage.removeItem('fs_tenant');
    } finally {
      setActivating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8">

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Shield size={24} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-1">
          FlowSentinel
        </h2>

        {/* ── SCREEN: Company code ── */}
        {screen === SCREEN.COMPANY && (
          <>
            <p className="text-center text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Enter your company code to continue
            </p>
            <form onSubmit={handleCompanyLookup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Company code
                </label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={companyCode}
                    onChange={e => setCompanyCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
                    )}
                    required maxLength={4}
                    placeholder="e.g. ACEK"
                    autoFocus
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest uppercase text-center text-lg"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-center">
                  4-character code provided during setup
                </p>
              </div>
              {lookupError && <Msg type="error">{lookupError}</Msg>}
              <button
                type="submit"
                disabled={lookingUp || companyCode.length !== 4}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {lookingUp
                  ? <RefreshCw className="animate-spin" size={18} />
                  : <><span>Continue</span><ArrowRight size={16} /></>
                }
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">New customer?</p>
              <button
                onClick={() => setScreen(SCREEN.ACTIVATE)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Activate a license key
              </button>
            </div>
          </>
        )}

        {/* ── SCREEN: Login ── */}
        {screen === SCREEN.LOGIN && (
          <>
            <p className="text-center text-slate-500 dark:text-slate-400 mb-6 text-sm">
              {loginMode === 'forgot' ? 'Reset your password' : 'Sign in to continue'}
            </p>

            {/* Sign in */}
            {loginMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email" type="email" icon={Mail}
                  value={email} onChange={setEmail} required />
                <div>
                  <Field label="Password" type="password" icon={Lock}
                    value={password} onChange={setPassword} required />
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
                {error && <Msg type="error">{error}</Msg>}
                {info && <Msg type="info">{info}</Msg>}
                <SubmitBtn loading={loading}>Sign In</SubmitBtn>
              </form>
            )}

            {/* Forgot: email step */}
            {loginMode === 'forgot' && forgotStep === 'email' && (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <button type="button" onClick={() => switchMode('login')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-1">
                  <ArrowLeft size={12} /> Back to sign in
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter your email and we'll send a 6-digit reset code.
                </p>
                <Field label="Email" type="email" icon={Mail}
                  value={email} onChange={setEmail} required />
                {error && <Msg type="error">{error}</Msg>}
                {info && <Msg type="info">{info}</Msg>}
                <SubmitBtn loading={loading}>Send reset code</SubmitBtn>
              </form>
            )}

            {/* Forgot: verify step */}
            {loginMode === 'forgot' && forgotStep === 'verify' && (
              <form onSubmit={handleForgotVerify} className="space-y-4">
                <button type="button"
                  onClick={() => { setForgotStep('email'); setOtp(''); setNewPassword(''); reset(); }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-1">
                  <ArrowLeft size={12} /> Use a different email
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter the 6-digit code from your email and choose a new password.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" value={email} disabled
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 rounded-lg outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">6-digit code</label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required maxLength={6} inputMode="numeric" placeholder="123456" autoFocus
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center" />
                  </div>
                </div>
                <Field label="New Password" type="password" icon={Lock}
                  value={newPassword} onChange={setNewPassword} required minLength={6} />
                {error && <Msg type="error">{error}</Msg>}
                {info && <Msg type="info">{info}</Msg>}
                <SubmitBtn loading={loading}>Reset password</SubmitBtn>
              </form>
            )}

            {/* Different company */}
            <button
              onClick={() => { setScreen(SCREEN.COMPANY); setError(''); setInfo(''); switchMode('login'); }}
              className="mt-5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1"
            >
              <ArrowLeft size={12} /> Different company
            </button>
          </>
        )}

        {/* ── SCREEN: Activate license ── */}
        {screen === SCREEN.ACTIVATE && (
          <>
            <p className="text-center text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Activate your FlowSentinel license
            </p>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {['License key', 'Your Supabase', 'Your account'].map((label, i) => {
                const stepKey = ['license', 'supabase', 'account'][i];
                const current = activateStep === stepKey;
                const done = ['license', 'supabase', 'account'].indexOf(activateStep) > i;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        current ? 'bg-indigo-600 text-white' :
                        done    ? 'bg-emerald-500 text-white' :
                                  'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] whitespace-nowrap ${
                        current ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                      }`}>{label}</span>
                    </div>
                    {i < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 mb-4" />}
                  </div>
                );
              })}
            </div>

            {/* Step 1: License key */}
            {activateStep === 'license' && (
              <form onSubmit={handleLicenseStep} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    License key
                  </label>
                  <input type="text" value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    required placeholder="FS.XXXX.XXXX.XXXX" autoFocus
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
                  <p className="text-xs text-slate-400 mt-1">
                    Your license key was emailed to you after purchase.
                  </p>
                </div>
                {activateError && <Msg type="error">{activateError}</Msg>}
                <button type="submit" disabled={!licenseKey}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  Continue <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* Step 2: Supabase details */}
            {activateStep === 'supabase' && (
              <form onSubmit={handleSupabaseStep} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  FlowSentinel stores your data in your own Supabase project.
                  Find these values in Supabase Dashboard → Project Settings → API.
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supabase project URL
                  </label>
                  <input type="url" required placeholder="https://xxxxxxxxxxxx.supabase.co"
                    value={activateSbUrl} onChange={e => setActivateSbUrl(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Anon public key
                  </label>
                  <textarea required rows={3}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={activateSbAnonKey} onChange={e => setActivateSbAnonKey(e.target.value.trim())}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono resize-none" />
                </div>
                {activateError && <Msg type="error">{activateError}</Msg>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setActivateStep('license')}
                    className="px-4 py-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm">
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Account details */}
            {activateStep === 'account' && (
              <form onSubmit={handleActivate} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company name</label>
                  <input type="text" required placeholder="Acme Corporation"
                    value={activateCompanyName} onChange={e => setActivateCompanyName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company code</label>
                  <input type="text" required placeholder="ACEK" maxLength={4}
                    value={activateCompanyCode}
                    onChange={e => setActivateCompanyCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
                    )}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-center text-lg uppercase" />
                  <p className="text-xs text-slate-400 mt-1">
                    4 letters or numbers. Your team types this to sign in.
                    {activateCompanyCode.length === 4 && (
                      <span className="text-indigo-500 ml-1 font-medium">
                        Login code: <strong>{activateCompanyCode}</strong>
                      </span>
                    )}
                  </p>
                </div>
                <Field label="Your full name" icon={Building2}
                  value={activateName} onChange={setActivateName} required />
                <Field label="Your email" type="email" icon={Mail}
                  value={activateEmail} onChange={setActivateEmail} required />
                <Field label="Password (min 6 chars)" type="password" icon={Lock}
                  value={activatePassword} onChange={setActivatePassword} required minLength={6} />
                <p className="text-xs text-slate-400">
                  This account becomes the super admin for your organisation.
                </p>
                {activateError && <Msg type="error">{activateError}</Msg>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setActivateStep('supabase')}
                    className="px-4 py-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="submit"
                    disabled={activating || activateCompanyCode.length !== 4}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {activating
                      ? <RefreshCw className="animate-spin" size={16} />
                      : 'Activate & Create Account'}
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={() => {
                setScreen(SCREEN.COMPANY);
                setActivateStep('license');
                setActivateError('');
                setActivateCompanyCode('');
              }}
              className="mt-5 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1"
            >
              <ArrowLeft size={12} /> Already have a company code? Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, type = 'text', icon: Icon, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          {...rest} />
      </div>
    </div>
  );
}

function Msg({ type, children }) {
  const styles = {
    error: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800',
    info:  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  };
  return <div className={`text-sm p-3 rounded-lg border ${styles[type]}`}>{children}</div>;
}

function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center">
      {loading ? <RefreshCw className="animate-spin" size={18} /> : children}
    </button>
  );
}