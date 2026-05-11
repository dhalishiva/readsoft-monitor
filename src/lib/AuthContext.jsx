import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('rsm_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rsm_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadAdmin(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadAdmin(newSession.user.id);
      else { setAdmin(null); setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadAdmin(userId) {
    const { data, error } = await supabase
      .from('admins').select('*').eq('id', userId).single();
    if (!error) setAdmin(data);
    setLoading(false);
  }

  // Re-fetch admin row (used when status might have changed, like after approval)
  const refreshAdmin = async () => {
    if (!session) return;
    await loadAdmin(session.user.id);
  };

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password, fullName, signupReason) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, signup_reason: signupReason } },
    });

  const signOut = () => supabase.auth.signOut();

  const toggleDarkMode = () => setDarkMode(d => !d);

  return (
    <AuthContext.Provider value={{
      session, admin, loading,
      signIn, signUp, signOut, refreshAdmin,
      darkMode, toggleDarkMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);