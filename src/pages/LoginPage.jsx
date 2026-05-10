import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminCount, setAdminCount] = useState(null);

  // Check if any admins exist — if not, force signup mode (first admin creation)
  useEffect(() => {
    supabase.from('admins').select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        setAdminCount(count ?? 0);
        if (count === 0) setMode('signup');
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);

    setLoading(false);

    if (error) setError(error.message);
    else navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-indigo-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Mail size={24} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">ReadSoft Monitor</h2>
        <p className="text-center text-slate-500 mb-8">
          {adminCount === 0 ? 'Create the first admin account' : 'Sign in to continue'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Full Name" icon={User} value={fullName} onChange={setFullName} required />
          )}
          <Field label="Email" type="email" icon={Mail} value={email} onChange={setEmail} required />
          <Field label="Password" type="password" icon={Lock} value={password} onChange={setPassword} required minLength={6} />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : (mode === 'login' ? 'Sign In' : 'Create Admin Account')}
          </button>
        </form>

        {adminCount > 0 && (
          <p className="text-center text-sm text-slate-500 mt-6">
            New admins are added by invitation only.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, type = 'text', icon: Icon, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          {...rest}
        />
      </div>
    </div>
  );
}