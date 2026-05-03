// Reusable session runner — used by Practice, Arena, and Review (single-question mode).
import { useState, useEffect, useRef } from 'react';
import { Flag, SkipForward, AlertTriangle } from 'lucide-react';
import MultipleChoice from './MultipleChoice.jsx';
import Flashcard from './Flashcard.jsx';
import Scenario from './Scenario.jsx';
import DragMatch from './DragMatch.jsx';
import CommentThread from './CommentThread.jsx';
import ReportModal from './ReportModal.jsx';
import ProgressRing from '../shared/ProgressRing.jsx';
import XPToast from '../shared/XPToast.jsx';
import { useProgressStore } from '../../store/progressStore.js';

const TYPE_COMPONENT = {
  'mc': MultipleChoice,
  'mc-multi': MultipleChoice,
  'scenario': Scenario,
  'flashcard': Flashcard,
  'drag-match': DragMatch,
};

export default function SessionRunner({
  questions,
  multiplier = 1,
  mode = 'practice',
  onFinish,
  arenaTone = false,
}) {
  const recordAttempt = useProgressStore((s) => s.recordAttempt);
  const addToReviewQueue = useProgressStore((s) => s.addToReviewQueue);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [questionState, setQuestionState] = useState('idle'); // idle | answered
  const [lastXP, setLastXP] = useState(null);
  const [flagged, setFlagged] = useState(new Set());
  const [reportingId, setReportingId] = useState(null);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [breakthrough, setBreakthrough] = useState(false);
  const containerRef = useRef(null);

  const q = questions[index];
  const Component = TYPE_COMPONENT[q?.type] || MultipleChoice;

  useEffect(() => {
    setQuestionState('idle');
  }, [index]);

  if (!q) return null;

  const handleAnswered = ({ correct }) => {
    const result = recordAttempt({ question: q, correct, multiplier });
    setLastXP({ amount: result.xpDelta, leveledUp: result.leveledUp, key: Date.now() });
    if (arenaTone && result.leveledUp) {
      setBreakthrough(true);
      setTimeout(() => setBreakthrough(false), 1600);
    }
    if (!correct) addToReviewQueue(q.id);
    setResponses((prev) => [...prev, {
      questionId: q.id,
      correct,
      skipped: false,
      xpDelta: result.xpDelta,
      leveledUp: result.leveledUp,
      subtopic: q.subtopic,
      domain: q.domain,
      flagged: flagged.has(q.id),
    }]);
    setQuestionState('answered');
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      finish([...responses]);
    } else {
      setIndex(index + 1);
    }
  };

  const skip = () => {
    setResponses((prev) => [...prev, {
      questionId: q.id,
      correct: false,
      skipped: true,
      xpDelta: 0,
      leveledUp: false,
      subtopic: q.subtopic,
      domain: q.domain,
      flagged: flagged.has(q.id),
    }]);
    if (index + 1 >= questions.length) finish([...responses, { questionId: q.id, correct: false, skipped: true, xpDelta: 0 }]);
    else setIndex(index + 1);
  };

  const finish = (rs) => {
    const counted = rs.filter((r) => !r.skipped);
    const score = counted.filter((r) => r.correct).length;
    const total = counted.length;
    const xpEarned = rs.reduce((s, r) => s + (r.xpDelta || 0), 0);
    const breakdown = {};
    rs.forEach((r) => {
      if (!breakdown[r.subtopic]) breakdown[r.subtopic] = { correct: 0, total: 0 };
      if (!r.skipped) {
        breakdown[r.subtopic].total += 1;
        if (r.correct) breakdown[r.subtopic].correct += 1;
      }
    });
    onFinish({ score, total, xpEarned, topicBreakdown: breakdown, mode, responses: rs });
  };

  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id); else { next.add(q.id); addToReviewQueue(q.id); }
      return next;
    });
  };

  const accent = arenaTone ? 'var(--accent-amber)' : 'var(--accent-teal)';

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono">Question {index + 1} / {questions.length}</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
            {q.domain.toUpperCase()} · {q.subtopic}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
            DIFF {q.difficulty}
          </span>
          {multiplier > 1 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded text-[#0d0f14]" style={{ background: accent }}>
              {multiplier}× XP
            </span>
          )}
        </div>
        <ProgressRing value={index + (questionState === 'answered' ? 1 : 0)} total={questions.length} />
      </div>

      {breakthrough && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-4xl font-mono font-bold text-[var(--accent-amber)] animate-pulse drop-shadow-[0_0_20px_rgba(245,166,35,0.8)]">
            BREAKTHROUGH
          </div>
        </div>
      )}

      <div className="surface p-6 relative">
        {lastXP && <XPToast key={lastXP.key} amount={lastXP.amount} leveledUp={lastXP.leveledUp} />}
        <Component key={q.id} question={q} onAnswered={handleAnswered} />

        {questionState === 'answered' && <CommentThread questionId={q.id} />}

        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleFlag}
              className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded border transition-colors ${
                flagged.has(q.id)
                  ? 'border-[var(--accent-amber)] text-[var(--accent-amber)] bg-amber-900/20'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent-amber)] hover:border-[var(--accent-amber)]'
              }`}>
              <Flag size={12} />
              {flagged.has(q.id) ? 'Flagged' : 'Flag for review'}
            </button>
            <button
              onClick={() => !reportedIds.has(q.id) && setReportingId(q.id)}
              disabled={reportedIds.has(q.id)}
              className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded border transition-colors ${
                reportedIds.has(q.id)
                  ? 'border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent-coral)] hover:border-[var(--accent-coral)]'
              }`}>
              <AlertTriangle size={12} />
              {reportedIds.has(q.id) ? 'Reported' : 'Report'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {questionState !== 'answered' && (
              <button onClick={skip}
                className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]">
                <SkipForward size={12} />
                Skip
              </button>
            )}
            {questionState === 'answered' && (
              <button onClick={next}
                className="px-5 py-2 rounded-lg font-mono text-sm font-bold text-[#0d0f14]"
                style={{ background: accent }}>
                {index + 1 >= questions.length ? 'Finish' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {reportingId && (
        <ReportModal
          questionId={reportingId}
          onClose={() => setReportingId(null)}
          onSubmitted={({ ok }) => {
            if (ok) {
              setReportedIds((prev) => new Set(prev).add(reportingId));
              setToast("Thanks \u2014 we'll review this question.");
              setTimeout(() => setToast(null), 2400);
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 surface px-4 py-2 text-sm font-mono shadow-lg border border-[var(--border-accent)]">
          {toast}
        </div>
      )}
    </div>
  );
}
