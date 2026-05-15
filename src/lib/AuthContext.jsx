import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext({});

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

function createTenantClient(supabase_url, supabase_anon_key) {
  return createClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: `fs_auth_${supabase_url}`,
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

  // Track whether we've done the initial load
  // so tab-focus auth refreshes don't cause a full reload
  const initialLoadDone = useRef(false);
  const adminLoadingRef = useRef(false);

  // On mount: check if we have a saved tenant
  useEffect(() => {
    const saved = getTenantFromStorage();
    if (saved?.supabase_url && saved?.supabase_anon_key) {
      const client = createTenantClient(saved.supabase_url, saved.supabase_anon_key);
      setSupabase(client);
      setTenant(saved);
    } else {
      // No tenant saved — not logged in
      setLoading(false);
    }
  }, []);

  // When supabase client is set/changed, initialise auth
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    initialLoadDone.current = false;
    setLoading(true);

    // Get the current session first
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        loadAdmin(supabase, s.user.id, true);
      } else {
        setAdmin(null);
        setLoading(false);
        initialLoadDone.current = true;
      }
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // TOKEN_REFRESHED fires when tab regains focus — don't reload the whole UI
      // Just update the session silently
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        return;
      }

      // SIGNED_IN fires on actual login
      // SIGNED_OUT fires on logout
      // USER_UPDATED fires on password change
      setSession(newSession);

      if (newSession) {
        // Only show loading spinner on initial load, not on token refresh
        if (!initialLoadDone.current) {
          setLoading(true);
        }
        loadAdmin(supabase, newSession.user.id, !initialLoadDone.current);
      } else {
        setAdmin(null);
        setLoading(false);
        initialLoadDone.current = true;
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const loadAdmin = async (client, userId, showLoading = false) => {
    // Prevent duplicate concurrent loads
    if (adminLoadingRef.current) return;
    adminLoadingRef.current = true;

    // if (showLoading) setLoading(true);
    setLoading(true);

    try {
      const { data, error } = await client
        .from('admins')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('loadAdmin error:', error.message);
        setAdmin(null);
      } else {
        setAdmin(data || null);
      }
    } catch (err) {
      console.warn('loadAdmin exception:', err.message);
      setAdmin(null);
    } finally {
      adminLoadingRef.current = false;
      initialLoadDone.current = true;
      if (showLoading) setLoading(false);
      else setLoading(false);
    }
  };

  const refreshAdmin = async () => {
    if (!supabase || !session) return;
    try {
      const { data } = await supabase
        .from('admins')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) setAdmin(data);
    } catch {}
  };

  // Called after company code lookup
  const initialiseTenant = (tenantData) => {
    const client = createTenantClient(tenantData.supabase_url, tenantData.supabase_anon_key);
    saveTenantToStorage(tenantData);
    setTenant(tenantData);
    setSupabase(client);
  };

  // Called during new signup activation
  const registerTenant = (tenantData) => {
    saveTenantToStorage(tenantData);
    setTenant(tenantData);
    const client = createTenantClient(tenantData.supabase_url, tenantData.supabase_anon_key);
    setSupabase(client);
  };

  const signIn = async (email, password) => {
    if (!supabase) return { error: new Error('No tenant selected') };
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, full_name, signup_reason) => {
    if (!supabase) return { error: new Error('No tenant selected') };
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, signup_reason } },
    });
  };

  const signOut = async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    clearTenantFromStorage();
    initialLoadDone.current = false;
    setSession(null);
    setAdmin(null);
    setTenant(null);
    setSupabase(null);
    setLoading(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem('fs_dark', String(next));
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <AuthContext.Provider value={{
      supabase,
      tenant,
      session,
      admin,
      loading,
      darkMode,
      toggleDarkMode,
      signIn,
      signUp,
      signOut,
      initialiseTenant,
      registerTenant,
      refreshAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);