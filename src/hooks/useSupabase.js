import { useMemo } from 'react';
import { useSession } from '@clerk/clerk-react';
import { createSupabaseClient } from '../lib/supabase.js';

// Returns a Supabase client whose auth token is sourced from the current Clerk session.
export function useSupabase() {
  const { session } = useSession();
  return useMemo(
    () => createSupabaseClient(() => (session ? session.getToken() : Promise.resolve(null))),
    [session]
  );
}
