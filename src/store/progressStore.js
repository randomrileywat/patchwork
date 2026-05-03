import { create } from 'zustand';
import { computeRollingScore, masteryLevelFromScore, xpForCorrect } from '../utils/scoring.js';
import { todayISO, daysBetween } from '../utils/storage.js';
import { getSupabase, getUserId } from '../lib/supabaseRef.js';

const initialState = {
  topics: {},
  totalXP: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionDate: null,
  sessions: [],
  reviewQueue: [],
  recentQuestionIds: [],
  hydrated: false,
};

const ensureTopic = (state, subtopic) => {
  if (!state.topics[subtopic]) {
    state.topics[subtopic] = { attempts: [], xpEarned: 0, masteryLevel: 0, rollingScore: 0 };
  }
};

// --- Supabase write helpers (fire-and-forget) ---
const upsertTopic = (subtopic, data) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_progress')
    .upsert(
      {
        user_id: userId,
        topic_id: subtopic,
        attempts: data.attempts,
        mastery_level: data.masteryLevel,
        rolling_score: data.rollingScore ?? 0,
        xp_earned: data.xpEarned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,topic_id' }
    )
    .then(({ error }) => {
      if (error) console.error('[progress upsert]', error);
    });
};

const upsertXP = (state) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_xp')
    .upsert(
      {
        user_id: userId,
        total: state.totalXP,
        current_streak: state.currentStreak,
        longest_streak: state.longestStreak,
        last_session_date: state.lastSessionDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .then(({ error }) => {
      if (error) console.error('[xp upsert]', error);
    });
};

const insertSession = (session) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_sessions')
    .insert({
      user_id: userId,
      completed_at: new Date(session.endedAt).toISOString(),
      score: session.total > 0 ? session.score / session.total : 0,
      question_count: session.total,
      xp_earned: session.xpEarned,
      topic_breakdown: session.topicBreakdown,
      mode: session.mode,
    })
    .then(({ error }) => {
      if (error) console.error('[session insert]', error);
    });
};

const upsertReviewItem = (questionId) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_review_queue')
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        added_at: new Date().toISOString(),
        attempt_count: 0,
      },
      { onConflict: 'user_id,question_id' }
    )
    .then(({ error }) => {
      if (error) console.error('[review upsert]', error);
    });
};

const deleteReviewItem = (questionId) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_review_queue')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .then(({ error }) => {
      if (error) console.error('[review delete]', error);
    });
};

const updateReviewAttempt = (questionId, count) => {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  supabase
    .from('patch_review_queue')
    .update({ attempt_count: count })
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .then(({ error }) => {
      if (error) console.error('[review update]', error);
    });
};

export const useProgressStore = create((set, get) => ({
  ...initialState,

  hydrate: ({ topics, sessions, xp, reviewQueue }) => {
    set({
      topics: topics || {},
      sessions: sessions || [],
      totalXP: xp?.total ?? 0,
      currentStreak: xp?.current_streak ?? 0,
      longestStreak: xp?.longest_streak ?? 0,
      lastSessionDate: xp?.last_session_date ?? null,
      reviewQueue: reviewQueue || [],
      hydrated: true,
    });
  },

  recordAttempt: ({ question, correct, multiplier = 1 }) => {
    const state = get();
    const next = { ...state, topics: { ...state.topics } };
    ensureTopic(next, question.subtopic);
    const t = { ...next.topics[question.subtopic] };
    t.attempts = [
      ...t.attempts,
      { questionId: question.id, correct, timestamp: Date.now(), difficulty: question.difficulty },
    ];
    const prevScore = computeRollingScore(state.topics[question.subtopic]?.attempts || []) ?? 0;
    const prevLevel = masteryLevelFromScore(
      prevScore,
      (state.topics[question.subtopic]?.attempts || []).length
    ).level;
    const newScore = computeRollingScore(t.attempts) ?? 0;
    const newLevel = masteryLevelFromScore(newScore, t.attempts.length).level;

    let xpDelta = 0;
    if (correct) xpDelta += xpForCorrect(question.difficulty, multiplier);
    const leveledUp = newLevel > prevLevel;
    if (leveledUp) xpDelta += 100;

    t.xpEarned = (t.xpEarned || 0) + xpDelta;
    t.masteryLevel = newLevel;
    t.rollingScore = newScore;
    next.topics[question.subtopic] = t;

    const recent = [...state.recentQuestionIds, question.id].slice(-10);
    const newTotalXP = state.totalXP + xpDelta;

    set({
      topics: next.topics,
      totalXP: newTotalXP,
      recentQuestionIds: recent,
    });

    upsertTopic(question.subtopic, t);
    upsertXP({ ...state, totalXP: newTotalXP });

    return { xpDelta, leveledUp, newLevel, prevLevel };
  },

  finishSession: ({ score, total, topicBreakdown, xpEarned, mode = 'practice' }) => {
    const state = get();
    const today = todayISO();
    let { currentStreak, longestStreak, lastSessionDate, totalXP } = state;
    let streakXP = 0;

    if (total >= 5) {
      if (!lastSessionDate) {
        currentStreak = 1;
      } else if (lastSessionDate === today) {
        // already counted today
      } else {
        const gap = daysBetween(lastSessionDate, today);
        if (gap === 1) {
          currentStreak += 1;
          streakXP = 50;
          totalXP += 50;
        } else if (gap > 1) {
          currentStreak = 1;
        }
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      lastSessionDate = today;
    }

    const sessionBonus = total >= 10 ? 25 : 0;
    totalXP += sessionBonus;

    const session = {
      id: `s-${Date.now()}`,
      endedAt: Date.now(),
      startedAt: state._sessionStartedAt || Date.now(),
      score,
      total,
      pct: total > 0 ? Math.round((score / total) * 100) : 0,
      topicBreakdown,
      xpEarned: xpEarned + sessionBonus + streakXP,
      mode,
      date: today,
    };

    const newState = {
      sessions: [...state.sessions, session].slice(-200),
      currentStreak,
      longestStreak,
      lastSessionDate,
      totalXP,
      _sessionStartedAt: null,
    };
    set(newState);

    insertSession(session);
    upsertXP({ ...state, ...newState });

    return session;
  },

  markSessionStart: () => set({ _sessionStartedAt: Date.now() }),

  addToReviewQueue: (questionId) => {
    const state = get();
    if (state.reviewQueue.find((r) => r.questionId === questionId)) return;
    set({
      reviewQueue: [
        ...state.reviewQueue,
        { questionId, addedAt: Date.now(), attempts: 0 },
      ],
    });
    upsertReviewItem(questionId);
  },

  removeFromReviewQueue: (questionId) => {
    const state = get();
    set({ reviewQueue: state.reviewQueue.filter((r) => r.questionId !== questionId) });
    deleteReviewItem(questionId);
  },

  bumpReviewAttempt: (questionId) => {
    const state = get();
    const existing = state.reviewQueue.find((r) => r.questionId === questionId);
    const newCount = (existing?.attempts || 0) + 1;
    set({
      reviewQueue: state.reviewQueue.map((r) =>
        r.questionId === questionId ? { ...r, attempts: newCount } : r
      ),
    });
    updateReviewAttempt(questionId, newCount);
  },

  reset: () => set({ ...initialState, hydrated: true }),
}));
