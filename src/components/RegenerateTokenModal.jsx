import { useState } from 'react';
import { Key, Copy, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { regenerateToken } from '../lib/edgeFunctions';

export default function RegenerateTokenModal({ mailbox, onClose, onSuccess }) {
  const { supabase } = useAuth();
  const [step, setStep]     = useState('confirm');
  const [newToken, setNewToken] = useState('');
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

  const handleConfirm = async () => {
    setStep('working');
    try {
      const result = await regenerateToken(supabase, mailbox.id);
      setNewToken(result.new_refresh_token);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  const copyToken = async () => {
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4">
            <Key className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>

          {step === 'confirm' && (
            <>
              <h3 className="text-lg font-semibold text-center text-slate-900 dark:text-white">
                Generate New Refresh Token?
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                This calls Microsoft Graph and generates a fresh refresh token for{' '}
                <strong className="text-slate-700 dark:text-slate-300">{mailbox.email}</strong>.
              </p>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">After clicking, you'll need to:</p>
                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                  <li>Copy the new token from the next screen</li>
                  <li>Paste it into ReadSoft's backend config</li>
                  <li>Come back here, click <strong>Edit</strong> on this mailbox, and paste the same token</li>
                </ol>
              </div>
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Until you complete steps 2 and 3, the stored token won't change and alerts will keep firing.
                </p>
              </div>
            </>
          )}

          {step === 'working' && (
            <p className="text-center text-slate-600 dark:text-slate-400 py-4">
              Calling Microsoft Graph...
            </p>
          )}

          {step === 'done' && (
            <>
              <h3 className="text-lg font-semibold text-center text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-2">
                <CheckCircle size={20} /> New Token Generated
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
                Copy this token. You'll need it in two places.
              </p>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto">
                  {newToken}
                </div>
              </div>
              <button onClick={copyToken}
                className="w-full mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Copy size={16} /> {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">Next steps:</p>
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <ArrowRight size={12} className="shrink-0 mt-0.5" />
                    <span>Paste into ReadSoft's backend config</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight size={12} className="shrink-0 mt-0.5" />
                    <span>Click <strong>Edit</strong> on this mailbox card and paste here too</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'error' && (
            <>
              <h3 className="text-lg font-semibold text-center text-red-700 dark:text-red-400">
                Generation Failed
              </h3>
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex gap-2 justify-end rounded-b-2xl">
          {step === 'confirm' && (
            <>
              <button onClick={onClose}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                Yes, Generate
              </button>
            </>
          )}
          {step === 'working' && (
            <button disabled className="px-6 py-2 bg-indigo-300 text-white rounded-lg text-sm">
              Working...
            </button>
          )}
          {(step === 'done' || step === 'error') && (
            <button onClick={() => { onSuccess(); onClose(); }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}