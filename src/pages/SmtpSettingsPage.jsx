import { useEffect, useState } from 'react';
import { Send, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Lock, ShieldOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { testSmtp } from '../lib/edgeFunctions';

// ── Passphrase gate ───────────────────────────────────────────────────────────
// VITE_SMTP_SETUP_PASSWORD must be set in Vercel env vars during onboarding.
// Once SMTP is configured and working, remove the env var and redeploy —
// the page will permanently show "Access not available" to everyone.
const SETUP_PASSWORD = import.meta.env.VITE_SMTP_SETUP_PASSWORD;

export default function SmtpSettingsPage() {
  const { admin, supabase } = useAuth();

  // Gate state — unlocked for this session only
  const [unlocked, setUnlocked]     = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [gateError, setGateError]   = useState('');

  // SMTP form state
  const [config, setConfig] = useState({
    host: '', port: 587, username: '', password: '',
    use_tls: true, from_email: '', from_name: 'FlowSentinel',
  });
  const [useSmtpAuth, setUseSmtpAuth] = useState(true);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState(null);
  const [testEmail, setTestEmail]     = useState('');
  const [testStatus, setTestStatus]   = useState(null);
  const [showPass, setShowPass]       = useState(false);

  // Load existing config once unlocked
  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    supabase.from('smtp_config').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig(data);
          setUseSmtpAuth(!!(data.username && data.password));
        }
        setLoading(false);
      });
  }, [unlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    setGateError('');

    // Env var not set — page is permanently locked
    if (!SETUP_PASSWORD) {
      setGateError('Setup access is not available.');
      return;
    }

    if (passphrase !== SETUP_PASSWORD) {
      setGateError('Incorrect passphrase.');
      setPassphrase('');
      return;
    }

    setUnlocked(true);
  };

  const update = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setConfig({ ...config, [field]: val });
  };

  const handleSave = async () => {
    setSaving(true); setSavedMsg(null);
    const payload = {
      ...config, id: 1,
      port: parseInt(config.port, 10),
      username: useSmtpAuth ? config.username : null,
      password: useSmtpAuth ? config.password : null,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('smtp_config').upsert(payload);
    setSaving(false);
    setSavedMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'SMTP settings saved.' }
    );
  };

  const handleTest = async () => {
    setTestStatus({ kind: 'sending' });
    try {
      await testSmtp(supabase, testEmail);
      setTestStatus({ kind: 'success' });
    } catch (err) {
      setTestStatus({ kind: 'error', msg: err.message });
    }
  };

  // ── Gate: env var not set = permanently locked ────────────────────────────
  if (!SETUP_PASSWORD) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <ShieldOff size={22} className="text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Access not available
          </h2>
          <p className="text-sm text-slate-400">
            This page is not accessible.
          </p>
        </div>
      </div>
    );
  }

  // ── Gate: passphrase entry ────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 w-full max-w-sm">
          <div className="flex justify-center mb-5">
            <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Lock size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-center text-slate-900 dark:text-white mb-1">
            SMTP Setup
          </h2>
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
            Enter the setup passphrase to continue.
          </p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Setup passphrase"
                autoFocus
                required
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {gateError && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XCircle size={14} /> {gateError}
              </p>
            )}
            <button
              type="submit"
              disabled={!passphrase}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── SMTP settings (unlocked) ──────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-slate-500">
      <RefreshCw className="animate-spin" size={16} /> Loading...
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SMTP Configuration</h1>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
          <CheckCircle size={11} /> Setup mode
        </span>
      </div>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
        Outbound email settings for all monitoring alerts.
      </p>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMTP Host" value={config.host} onChange={update('host')} placeholder="smtp.gmail.com" />
          <Field label="Port" type="number" value={config.port} onChange={update('port')} />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={config.use_tls} onChange={update('use_tls')} className="rounded" />
            Use TLS
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From email" type="email" value={config.from_email}
            onChange={update('from_email')} placeholder="alerts@company.com" />
          <Field label="From name" value={config.from_name} onChange={update('from_name')} />
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={useSmtpAuth}
              onChange={e => setUseSmtpAuth(e.target.checked)} className="rounded" />
            SMTP server requires authentication
          </label>
          <p className="text-xs text-slate-400 mt-1 ml-6">
            Leave unchecked for internal relays that accept unauthenticated connections.
          </p>
        </div>

        {useSmtpAuth && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" value={config.username || ''} onChange={update('username')} />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password / App Password
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'}
                  value={config.password || ''} onChange={update('password')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm pr-9" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {savedMsg && (
          <p className={`text-sm flex items-center gap-1.5 ${savedMsg.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {savedMsg.type === 'success' && <CheckCircle size={14} />}
            {savedMsg.text}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Test email */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="font-semibold mb-3 text-slate-900 dark:text-white flex items-center gap-2">
          <Send size={16} /> Send Test Email
        </h2>
        <div className="flex gap-2">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="recipient@company.com"
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          <button onClick={handleTest} disabled={!testEmail || testStatus?.kind === 'sending'}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 text-sm">
            {testStatus?.kind === 'sending' ? 'Sending...' : 'Send test'}
          </button>
        </div>
        {testStatus?.kind === 'success' && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle size={14} /> Test email sent successfully.
          </p>
        )}
        {testStatus?.kind === 'error' && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <XCircle size={14} /> {testStatus.msg}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <input {...rest}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
    </div>
  );
}