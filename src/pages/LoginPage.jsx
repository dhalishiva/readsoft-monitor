import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, RefreshCw, MessageSquare, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { requestPasswordReset, verifyPasswordReset } from '../lib/edgeFunctions';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(null);
  const [initializedLoaded, setInitializedLoaded] = useState(false);

  // Forgot-password state
  const [forgotStep, setForgotStep] = useState('email'); // 'email' | 'verify'
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    supabase.rpc('has_any_admin').then(({ data, error }) => {
      if (error) {
        console.error('has_any_admin failed:', error);
        setSystemInitialized(true);
      } else {
        setSystemInitialized(!!data);
        if (data === false) setMode('signup');
      }
      setInitializedLoaded(true);
    });
  }, []);

  const reset = () => { setError(''); setInfo(''); };

  const switchMode = (newMode) => {
    setMode(newMode);
    reset();
    setForgotStep('email');
    setOtp('');
    setNewPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError('Invalid email or password.');
    else navigate('/');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    const { error } = await signUp(email, password, fullName, reason);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      if (!systemInitialized) {
        navigate('/');
      } else {
        await supabase.auth.signOut();
        setInfo('Your access request has been submitted. An admin will review it. You can sign in once approved.');
        switchMode('login');
      }
    }
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setInfo('If an account exists for this email, a 6-digit code has been sent. Check your inbox (and spam).');
      setForgotStep('verify');
    } catch (err) {
      // We never expose specific errors to avoid email enumeration
      setInfo('If an account exists for this email, a 6-digit code has been sent. Check your inbox (and spam).');
      setForgotStep('verify');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async (e) => {
  e.preventDefault();
  reset();
  setLoading(true);
  try {
    await verifyPasswordReset(email, otp, newPassword);
    // Switch to login mode first, then set the success message (switchMode clears messages)
    setMode('login');
    setForgotStep('email');
    setOtp('');
    setNewPassword('');
    setPassword('');
    setError('');
    setInfo('Password reset successfully. Sign in with your new password.');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  if (!initializedLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Mail size={24} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
          ReadSoft Monitor
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-6">
          {!systemInitialized ? 'Create the first admin account' :
           mode === 'login' ? 'Sign in to continue' :
           mode === 'signup' ? 'Request access' :
           'Reset your password'}
        </p>

        {systemInitialized && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <TabBtn active={mode === 'login'} onClick={() => switchMode('login')}>Sign In</TabBtn>
            <TabBtn active={mode === 'signup'} onClick={() => switchMode('signup')}>Sign Up</TabBtn>
            <TabBtn active={mode === 'forgot'} onClick={() => switchMode('forgot')}>Forgot</TabBtn>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" type="email" icon={Mail} value={email} onChange={setEmail} required />
            <Field label="Password" type="password" icon={Lock} value={password} onChange={setPassword} required />
            {error && <Msg type="error">{error}</Msg>}
            {info && <Msg type="info">{info}</Msg>}
            <SubmitBtn loading={loading}>Sign In</SubmitBtn>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <Field label="Full Name" icon={User} value={fullName} onChange={setFullName} required />
            <Field label="Email" type="email" icon={Mail} value={email} onChange={setEmail} required />
            <Field label="Password" type="password" icon={Lock} value={password} onChange={setPassword} required minLength={6} />
            {systemInitialized && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Why do you need access?
                </label>
                <div className="relative">
                  <MessageSquare size={16} className="absolute left-3 top-3 text-slate-400" />
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    required
                    placeholder="e.g., Joining the APAC ops team and need to monitor approval mailboxes."
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            )}
            {error && <Msg type="error">{error}</Msg>}
            <SubmitBtn loading={loading}>
              {!systemInitialized ? 'Create Super Admin Account' : 'Request Access'}
            </SubmitBtn>
          </form>
        )}

        {mode === 'forgot' && forgotStep === 'email' && (
          <form onSubmit={handleForgotRequest} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter your email and we'll send a 6-digit code to reset your password.
            </p>
            <Field label="Email" type="email" icon={Mail} value={email} onChange={setEmail} required />
            {error && <Msg type="error">{error}</Msg>}
            {info && <Msg type="info">{info}</Msg>}
            <SubmitBtn loading={loading}>Send reset code</SubmitBtn>
          </form>
        )}

        {mode === 'forgot' && forgotStep === 'verify' && (
          <form onSubmit={handleForgotVerify} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter the 6-digit code from your email and choose a new password.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">6-digit code</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="\d{6}"
                  placeholder="123456"
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center"
                />
              </div>
            </div>
            <Field label="New Password" type="password" icon={Lock} value={newPassword} onChange={setNewPassword} required minLength={6} />
            {error && <Msg type="error">{error}</Msg>}
            {info && <Msg type="info">{info}</Msg>}
            <SubmitBtn loading={loading}>Reset password</SubmitBtn>
            <button
              type="button"
              onClick={() => { setForgotStep('email'); setOtp(''); setNewPassword(''); reset(); }}
              className="w-full text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, type = 'text', icon: Icon, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          {...rest}
        />
      </div>
    </div>
  );
}

function Msg({ type, children }) {
  const styles = {
    error: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  };
  return <div className={`text-sm p-3 rounded-lg border ${styles[type]}`}>{children}</div>;
}

function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
    >
      {loading ? <RefreshCw className="animate-spin" size={18} /> : children}
    </button>
  );
}