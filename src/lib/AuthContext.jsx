import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext({});

// Registry details — stored in localStorage after company code lookup
const TENANT_KEY = 'fs_tenant';

function getTenantFromStorage() {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveTenantToStorage(tenant) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

function clearTenantFromStorage() {
  localStorage.removeItem(TENANT_KEY);
}

// Create a Supabase client dynamically for a given tenant
function createTenantClient(supabase_url, supabase_anon_key) {
  return createClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: `fs_auth_${supabase_url}`, // unique key per tenant
    },
  });
}

export function AuthProvider({ children }) {
  const [supabase, setSupabase] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('fs_dark') === 'true'
  );

  // On mount: check if we have a saved tenant
  useEffect(() => {
    const saved = getTenantFromStorage();
    if (saved?.supabase_url && saved?.supabase_anon_key) {
      const client = createTenantClient(saved.supabase_url, saved.supabase_anon_key);
      setSupabase(client);
      setTenant(saved);
    } else {
      setLoading(false);
    }
  }, []);

  // When supabase client changes, set up auth listener
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s) loadAdmin(supabase, s.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setAdmin(null);
        loadAdmin(supabase, newSession.user.id);
      } else {
        setAdmin(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const loadAdmin = async (client, userId) => {
    try {
      const { data } = await client
        .from('admins').select('*').eq('id', userId).single();
      setAdmin(data || null);
    } catch { setAdmin(null); }
    finally { setLoading(false); }
  };

  const refreshAdmin = async () => {
    if (!supabase || !session) return;
    await loadAdmin(supabase, session.user.id);
  };

  // Called after company code lookup — initialises the tenant's Supabase client
  const initialiseTenant = (tenantData) => {
    const client = createTenantClient(tenantData.supabase_url, tenantData.supabase_anon_key);
    saveTenantToStorage(tenantData);
    setTenant(tenantData);
    setSupabase(client);
  };

  // Called during new signup — same as initialiseTenant
  const registerTenant = (tenantData) => {
    initialiseTenant(tenantData);
  };

  const signIn = async (email, password) => {
    if (!supabase) return { error: new Error('No tenant selected') };
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, full_name, signup_reason) => {
    if (!supabase) return { error: new Error('No tenant selected') };
    return supabase.auth.signUp({
      email, password,
      options: { data: { full_name, signup_reason } },
    });
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    clearTenantFromStorage();
    setSession(null);
    setAdmin(null);
    setTenant(null);
    setSupabase(null);
  };

  const toggleDarkMode = () => {
    setDarkMode(d => {
      localStorage.setItem('fs_dark', String(!d));
      return !d;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <AuthContext.Provider value={{
      supabase, tenant, session, admin, loading,
      darkMode, toggleDarkMode,
      signIn, signUp, signOut,
      initialiseTenant, registerTenant, refreshAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);