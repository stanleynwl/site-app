export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Until the Supabase project is provisioned and env vars are set, the app should
// still boot (login renders, shells route) — orchestration layers check this and
// skip auth work rather than crashing on a missing URL.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
