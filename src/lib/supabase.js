// import { createClient } from '@supabase/supabase-js';

// const url = import.meta.env.VITE_SUPABASE_URL;
// const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// if (!url || !key) {
//   throw new Error('Missing Supabase env vars. Check .env.local');
// }

// export const supabase = createClient(url, key);

// supabase.js — legacy shim
// The Supabase client is now dynamic per-tenant.
// All DB access should go through the `supabase` value from useAuth().
// This file exists only to avoid import errors during migration.

export const supabase = null;

// Usage in components: const { supabase } = useAuth(); instead of importing this