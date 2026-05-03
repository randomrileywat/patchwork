// Scoring, mastery levels, XP math, and timeline construction.

export const MASTERY_LEVELS = [
  { level: 0, label: 'Locked',     min: -1,   colorVar: '--mastery-0' },
  { level: 1, label: 'Novice',     min: 0,    colorVar: '--mastery-1' },
  { level: 2, label: 'Developing', min: 0.40, colorVar: '--mastery-2' },
  { level: 3, label: 'Proficient', min: 0.60, colorVar: '--mastery-3' },
  { level: 4, label: 'Expert',     min: 0.80, colorVar: '--mastery-4' },
];

export const computeRollingScore = (attempts, window = 20) => {
  if (!attempts || attempts.length === 0) return null;
  const recent = attempts.slice(-window);
  const correct = recent.filter((a) => a.correct).length;
  return correct / recent.length;
};

export const MIN_ATTEMPTS_FOR_MASTERY = 10;

export const masteryLevelFromScore = (score, attemptCount) => {
  if (!attemptCount || attemptCount < MIN_ATTEMPTS_FOR_MASTERY) return MASTERY_LEVELS[0];
  if (score >= 0.80) return MASTERY_LEVELS[4];
  if (score >= 0.60) return MASTERY_LEVELS[3];
  if (score >= 0.40) return MASTERY_LEVELS[2];
  return MASTERY_LEVELS[1];
};

export const xpForCorrect = (difficulty, multiplier = 1) => {
  const base = difficulty === 3 ? 35 : difficulty === 2 ? 20 : 10;
  return Math.round(base * multiplier);
};

// Build a date-keyed timeline of mastery percentages per subtopic + overall.
// progress = { topics: { [subtopicId]: { attempts: [{questionId, correct, timestamp}], ... } } }
export const buildMasteryTimeline = (progress) => {
  const topicEntries = Object.entries(progress?.topics || {});
  if (topicEntries.length === 0) return [];

  // Collect all unique calendar dates with any activity.
  const dateSet = new Set();
  topicEntries.forEach(([, t]) => {
    (t.attempts || []).forEach((a) => {
      const d = new Date(a.timestamp);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dateSet.add(iso);
    });
  });
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  // For each date, compute rolling score per topic using only attempts up to end-of-that-day.
  const lastKnown = {}; // subtopicId -> last computed pct
  const everSeen = new Set();
  const timeline = dates.map((iso) => {
    const cutoff = new Date(iso + 'T23:59:59.999').getTime();
    const row = { date: iso };
    let overallSum = 0;
    let overallCount = 0;
    topicEntries.forEach(([subtopic, t]) => {
      const upTo = (t.attempts || []).filter((a) => a.timestamp <= cutoff);
      if (upTo.length > 0) {
        const score = computeRollingScore(upTo);
        const pct = Math.round(score * 100);
        lastKnown[subtopic] = pct;
        everSeen.add(subtopic);
        row[subtopic] = pct;
        overallSum += pct;
        overallCount += 1;
      } else if (everSeen.has(subtopic)) {
        // carry-forward
        row[subtopic] = lastKnown[subtopic];
        overallSum += lastKnown[subtopic];
        overallCount += 1;
      }
    });
    row.overall = overallCount > 0 ? Math.round(overallSum / overallCount) : 0;
    return row;
  });
  return timeline;
};

export const greetingForNow = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export const formatDateLong = (date = new Date()) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
