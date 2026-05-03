import { createClient } from '@supabase/supabase-js';

// Factory: create a Supabase client whose auth token comes from Clerk's session.
// Clerk handles refresh automatically — Supabase will call this getter on every request.
export function createSupabaseClient(getToken) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      accessToken: async () => {
        try {
          return (await getToken()) ?? null;
        } catch {
          return null;
        }
      },
    }
  );
}
