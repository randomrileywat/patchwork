import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSupabase } from './useSupabase.js';
import { useProgressStore } from '../store/progressStore.js';
import { setSupabaseRef, clearSupabaseRef } from '../lib/supabaseRef.js';

// Performs first-load: registers supabase client globally, upserts user profile,
// and hydrates the progress store from the user's Supabase tables.
export function useProgressHydrator() {
  const { user, isLoaded } = useUser();
  const supabase = useSupabase();
  const hydrate = useProgressStore((s) => s.hydrate);
  const hydrated = useProgressStore((s) => s.hydrated);

  useEffect(() => {
    if (!isLoaded || !user) return;
    let cancelled = false;

    const run = async () => {
      setSupabaseRef(supabase, user.id);

      // 1. Upsert user profile (idempotent)
      const username =
        user.username ||
        user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
        `user-${user.id.slice(-6)}`;
      await supabase
        .from('patch_users')
        .upsert(
          {
            id: user.id,
            username,
            email: user.primaryEmailAddress?.emailAddress ?? null,
          },
          { onConflict: 'id' }
        )
        .then(({ error }) => {
          if (error) console.error('[users upsert]', error);
        });

      // 2. Fetch existing data in parallel
      const [progressRes, sessionsRes, xpRes, reviewRes] = await Promise.all([
        supabase.from('patch_progress').select('*').eq('user_id', user.id),
        supabase
          .from('patch_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: true })
          .limit(200),
        supabase.from('patch_xp').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('patch_review_queue').select('*').eq('user_id', user.id),
      ]);

      if (cancelled) return;

      // 3. Reshape to store format
      const topics = {};
      (progressRes.data || []).forEach((row) => {
        topics[row.topic_id] = {
          attempts: row.attempts || [],
          xpEarned: row.xp_earned || 0,
          masteryLevel: row.mastery_level || 0,
          rollingScore: Number(row.rolling_score) || 0,
        };
      });

      const sessions = (sessionsRes.data || []).map((row) => {
        const total = row.question_count || 0;
        const score = Math.round(Number(row.score) * total);
        return {
          id: row.id,
          endedAt: new Date(row.completed_at).getTime(),
          startedAt: new Date(row.completed_at).getTime(),
          score,
          total,
          pct: Math.round(Number(row.score) * 100),
          topicBreakdown: row.topic_breakdown || {},
          xpEarned: row.xp_earned || 0,
          mode: row.mode || 'practice',
          date: new Date(row.completed_at).toISOString().slice(0, 10),
        };
      });

      const reviewQueue = (reviewRes.data || []).map((row) => ({
        questionId: row.question_id,
        addedAt: new Date(row.added_at).getTime(),
        attempts: row.attempt_count || 0,
      }));

      hydrate({
        topics,
        sessions,
        xp: xpRes.data || null,
        reviewQueue,
      });
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  // Cleanup ref on unmount
  useEffect(() => {
    return () => clearSupabaseRef();
  }, []);

  return { hydrated };
}
