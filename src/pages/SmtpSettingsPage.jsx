import { useEffect, useState } from 'react';
import { Send, CheckCircle, XCircle, RefreshCw, Info } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { testSmtp } from '../lib/edgeFunctions';

export default function SmtpSettingsPage() {
  // ← dynamic client from AuthContext, not hardcoded supabase.js
  const { admin, supabase } = useAuth();

  const [config, setConfig] = useState({
    host: '', port: 587, username: '', password: '',
    use_tls: true, from_email: '', from_name: 'FlowSentinel',
  });
  const [useSmtpAuth, setUseSmtpAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('smtp_config').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig(data);
          setUseSmtpAuth(!!(data.username && data.password));
        }
        setLoading(false);
      });
  }, [supabase]);

  const update = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setConfig({ ...config, [field]: val });
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    const payload = {
      ...config,
      id: 1,
      port: parseInt(config.port, 10),
      username: useSmtpAuth ? config.username : null,
      password: useSmtpAuth ? config.password : null,
      updated_by: admin.id,
    };
    const { error } = await supabase.from('smtp_config').upsert(payload);
    setSaving(false);
    setSavedMsg(error ? `Error: ${error.message}` : 'Saved successfully.');
  };

  const handleTest = async () => {
    setTestStatus({ kind: 'sending' });
    try {
      await testSmtp(testEmail);
      setTestStatus({ kind: 'success' });
    } catch (err) {
      setTestStatus({ kind: 'error', msg: err.message });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-slate-500 dark:text-slate-400">
        <RefreshCw className="animate-spin inline mr-2" size={16} /> Loading...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold mb-2 text-slate-900 dark:text-white">
        SMTP Configuration
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
        Global outbound email settings used for all alerts and notifications.
      </p>

      {/* Main config card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">

        <Field label="SMTP Host" value={config.host} onChange={update('host')} placeholder="smtp-relay.brevo.com" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Port" type="number" value={config.port} onChange={update('port')} />
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={config.use_tls} onChange={update('use_tls')} />
              Use TLS
            </label>
          </div>
        </div>

        <Field label="From Email" type="email" value={config.from_email} onChange={update('from_email')} placeholder="alerts@yourcompany.com" />
        <Field label="From Name" value={config.from_name} onChange={update('from_name')} />

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={useSmtpAuth} onChange={e => setUseSmtpAuth(e.target.checked)} />
            SMTP server requires authentication
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
            Leave unchecked if your SMTP relay accepts unauthenticated connections.
          </p>
        </div>

        {useSmtpAuth && (
          <>
            <Field label="Username" value={config.username || ''} onChange={update('username')} />
            <Field label="Password" type="password" value={config.password || ''} onChange={update('password')} />
          </>
        )}

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
          <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            If your SMTP relay only allows internal network IPs, it may not accept connections
            from Supabase Edge Functions. Use an external relay like Brevo to avoid this.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <p className={`text-sm ${savedMsg.startsWith('Error') ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {savedMsg}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Test email card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mt-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
          <Send size={18} /> Send Test Email
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="recipient@company.com"
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button
            onClick={handleTest}
            disabled={!testEmail || testStatus?.kind === 'sending'}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg disabled:opacity-50 text-sm"
          >
            {testStatus?.kind === 'sending' ? 'Sending...' : 'Send Test'}
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
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <input
        {...rest}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-sm"
      />
    </div>
  );
}