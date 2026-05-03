import { useState } from 'react';
import { ChevronRight, CheckCircle2, Lock } from 'lucide-react';
import { EXAMS } from '../data/exams.js';
import allQuestions from '../data/questions.json';
import { useProgressStore } from '../store/progressStore.js';
import SessionRunner from '../components/questions/SessionRunner.jsx';

// ── starter question picker ─────────────────────────────────────────────────
// Picks `count` questions that span every subtopic of the exam.
// Prefers difficulty-1 questions so first-timers aren't overwhelmed.
// Excludes drag-match (too complex as a first impression).
function pickStarterQuestions(certId, count = 10) {
  const pool = allQuestions.filter(
    (q) => q.certification === certId && q.type !== 'drag-match'
  );

  // Group by subtopic, shuffle within each group
  const bySubtopic = {};
  pool.forEach((q) => {
    if (!bySubtopic[q.subtopic]) bySubtopic[q.subtopic] = [];
    bySubtopic[q.subtopic].push(q);
  });

  // Shuffle subtopic order
  const subtopics = Object.keys(bySubtopic);
  for (let i = subtopics.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [subtopics[i], subtopics[j]] = [subtopics[j], subtopics[i]];
  }

  const picked = [];
  for (const st of subtopics) {
    if (picked.length >= count) break;
    const group = bySubtopic[st];
    // Prefer difficulty 1; fall back to full group
    const easy = group.filter((q) => q.difficulty === 1);
    const source = easy.length > 0 ? easy : group;
    picked.push(source[Math.floor(Math.random() * source.length)]);
  }

  // If we still need more, top up from remaining unseen questions
  if (picked.length < count) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const remaining = pool.filter((q) => !pickedIds.has(q.id));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    picked.push(...remaining.slice(0, count - picked.length));
  }

  return picked.slice(0, count);
}

// ── Onboarding ───────────────────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep] = useState('select'); // 'select' | 'quiz'
  const [selectedExam, setSelectedExam] = useState(null);
  const [starterQuestions, setStarterQuestions] = useState([]);
  const finishSession = useProgressStore((s) => s.finishSession);
  const markSessionStart = useProgressStore((s) => s.markSessionStart);

  const handleStart = () => {
    const qs = pickStarterQuestions(selectedExam, 10);
    markSessionStart();
    setStarterQuestions(qs);
    setStep('quiz');
  };

  const handleFinish = (result) => {
    finishSession({ ...result, mode: 'onboarding' });
    // sessions.length is now > 0 → AppShell will automatically unmount Onboarding
    // and render the normal app with the Dashboard.
  };

  if (step === 'quiz') {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col">
        <header className="border-b border-[var(--border)] px-6 py-4 flex items-center gap-4">
          <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0">
            <path
              d="M2 16 L7 16 L9 8 L13 24 L17 6 L21 26 L25 12 L30 16"
              fill="none"
              stroke="var(--accent-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <span className="font-mono font-bold tracking-wider text-[var(--text-primary)]">PATCHWORK</span>
            <span className="text-[var(--text-muted)] mx-2">·</span>
            <span className="text-sm text-[var(--text-secondary)]">
              10-question diagnostic · {selectedExam}
            </span>
          </div>
        </header>
        <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-8 py-8 pb-12">
          <SessionRunner
            questions={starterQuestions}
            mode="onboarding"
            onFinish={handleFinish}
          />
        </div>
      </div>
    );
  }

  // ── step: select ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <svg viewBox="0 0 32 32" className="w-9 h-9">
            <path
              d="M2 16 L7 16 L9 8 L13 24 L17 6 L21 26 L25 12 L30 16"
              fill="none"
              stroke="var(--accent-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="font-mono font-bold tracking-wider text-xl text-[var(--text-primary)]">PATCHWORK</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Adaptive Study</div>
          </div>
        </div>

        <h1 className="font-mono text-3xl font-bold leading-tight mb-2">
          What are you<br />studying for?
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          We'll run a 10-question diagnostic to map your starting expertise across all exam domains.
        </p>

        {/* Exam cards */}
        <div className="space-y-3 mb-8">
          {EXAMS.map((exam) => {
            const isSelected = selectedExam === exam.id;
            return (
              <button
                key={exam.id}
                disabled={!exam.available}
                onClick={() => exam.available && setSelectedExam(exam.id)}
                className={[
                  'w-full text-left rounded-xl border p-4 transition-all',
                  exam.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                  isSelected
                    ? 'border-[var(--accent-teal)] bg-[var(--bg-elevated)] ring-1 ring-[var(--accent-teal)]'
                    : exam.available
                    ? 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="font-mono font-bold text-base"
                        style={{ color: isSelected ? exam.accent : 'var(--text-primary)' }}
                      >
                        {exam.name}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                        {exam.org}
                      </span>
                      {!exam.available && (
                        <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                          <Lock size={10} /> Coming soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mb-1">{exam.fullName}</div>
                    <div className="text-sm text-[var(--text-secondary)]">{exam.description}</div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-[var(--accent-teal)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={!selectedExam}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-bold text-[#0d0f14] transition-opacity disabled:opacity-30"
          style={{ background: 'var(--accent-teal)' }}
        >
          Start 10-question diagnostic
          <ChevronRight size={18} />
        </button>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          Takes ~5 minutes · results populate your expertise map immediately
        </p>
      </div>
    </div>
  );
}
