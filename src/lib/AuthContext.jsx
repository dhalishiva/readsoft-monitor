import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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

// Silent session update — only triggers re-render if user ID changed
// This prevents tab-focus token refreshes from causing a re-render
function isSameUser(prev, next) {
  return prev?.user?.id === next?.user?.id;
}

export function AuthProvider({ children }) {
  const [supabase, setSupabase]   = useState(null);
  const [tenant, setTenant]       = useState(null);
  const [session, setSession]     = useState(null);
  const [admin, setAdmin]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [darkMode, setDarkMode]   = useState(
    () => localStorage.getItem('fs_dark') === 'true'
  );

  const initialLoadDone  = useRef(false);
  const adminLoadingRef  = useRef(false);
  // Store admin in a ref too so the auth listener closure can read current value
  const adminRef         = useRef(null);

  // Keep adminRef in sync with admin state
  useEffect(() => { adminRef.current = admin; }, [admin]);

  // On mount: restore saved tenant
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

  // When supabase client changes, initialise auth listener
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    initialLoadDone.current = false;
    adminLoadingRef.current = false;
    setLoading(true);

    // Get initial session
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

    // Auth state listener
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // ── Silent events — update session only, never reload admin ───────────
      // TOKEN_REFRESHED: fires on tab focus when token is near expiry
      // USER_UPDATED: fires after supabase.auth.updateUser() (password change)
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Only update session state if user actually changed (virtually never)
        // This prevents the common tab-focus re-render
        setSession(prev => isSameUser(prev, newSession) ? prev : newSession);
        return;
      }

      // SIGNED_IN while already initialised and same user
      // This fires when ProfilePage calls signInWithPassword to verify current password
      if (
        event === 'SIGNED_IN' &&
        initialLoadDone.current &&
        adminRef.current?.id === newSession?.user?.id
      ) {
        setSession(prev => isSameUser(prev, newSession) ? prev : newSession);
        return;
      }

      // ── All other events (actual SIGNED_IN, SIGNED_OUT) ────────────────────
      setSession(newSession);

      if (newSession) {
        // Only show loading spinner on first load, not on subsequent auth events
        const shouldShowLoading = !initialLoadDone.current;
        if (shouldShowLoading) setLoading(true);
        loadAdmin(supabase, newSession.user.id, shouldShowLoading);
      } else {
        // Signed out
        setAdmin(null);
        adminRef.current = null;
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

    if (showLoading) setLoading(true);

    try {
      const { data, error } = await client
        .from('admins')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('loadAdmin error:', error.message);
        setAdmin(null);
        adminRef.current = null;
      } else {
        setAdmin(data || null);
        adminRef.current = data || null;
      }
    } catch (err) {
      console.warn('loadAdmin exception:', err.message);
      setAdmin(null);
      adminRef.current = null;
    } finally {
      adminLoadingRef.current = false;
      initialLoadDone.current = true;
      setLoading(false);
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
      if (data) {
        setAdmin(data);
        adminRef.current = data;
      }
    } catch {}
  };

  const initialiseTenant = (tenantData) => {
    const client = createTenantClient(tenantData.supabase_url, tenantData.supabase_anon_key);
    saveTenantToStorage(tenantData);
    setTenant(tenantData);
    setSupabase(client);
  };

  const registerTenant = (tenantData) => {
    saveTenantToStorage(tenantData);
    setTenant(tenantData);
    const client = createTenantClient(tenantData.supabase_url, tenantData.supabase_anon_key);
    setSupabase(client);
  };

  // Update the license portion of the saved tenant without recreating the
  // Supabase client (which would invalidate the current session). Used after
  // a successful renewal so the in-app banner & Profile page reflect the new
  // expiry immediately, with no reload.
  const updateTenantLicense = (newLicense) => {
    setTenant(prev => {
      if (!prev) return prev;
      const updated = { ...prev, license: { ...prev.license, ...newLicense } };
      saveTenantToStorage(updated);
      return updated;
    });
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
    adminRef.current = null;
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
      updateTenantLicense,
      refreshAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);