import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Play, RotateCcw, ChevronRight } from 'lucide-react';
import questions from '../data/questions.json';
import { pickRandomFromFilters } from '../utils/questionPicker.js';
import { useProgressStore } from '../store/progressStore.js';
import SessionRunner from '../components/questions/SessionRunner.jsx';

const ALL_DOMAINS = [
  { id: 'domain-a', label: 'A · Needs Assessment' },
  { id: 'domain-b', label: 'B · Project Documentation' },
  { id: 'domain-c', label: 'C · AV Design' },
  { id: 'domain-d', label: 'D · Project Implementation' },
];

const DECK_SIZES = [10, 20, 30, 50];

const FLASHCARD_POOL = questions.filter((q) => q.type === 'flashcard');

export default function FlashcardSession() {
  const finishSession = useProgressStore((s) => s.finishSession);
  const markSessionStart = useProgressStore((s) => s.markSessionStart);
  const recentIds = useProgressStore((s) => s.recentQuestionIds);

  const [domains, setDomains] = useState(['domain-a', 'domain-b', 'domain-c', 'domain-d']);
  const [deckSize, setDeckSize] = useState(20);
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);

  const available = useMemo(
    () => FLASHCARD_POOL.filter((q) => domains.includes(q.domain)).length,
    [domains],
  );

  const toggle = (arr, val, setter) =>
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const start = () => {
    const picked = pickRandomFromFilters(
      questions,
      { domains, types: ['flashcard'] },
      deckSize,
      recentIds,
    );
    if (picked.length === 0) {
      alert('No flashcards available for those domains. Select more domains.');
      return;
    }
    markSessionStart();
    setSession({ questions: picked });
    setSummary(null);
  };

  const handleFinish = (result) => {
    finishSession({ ...result, mode: 'flashcard' });
    setSummary(result);
    setSession(null);
  };

  if (session) {
    return (
      <div className="max-w-3xl mx-auto">
        <SessionRunner
          questions={session.questions}
          mode="flashcard"
          onFinish={handleFinish}
        />
      </div>
    );
  }

  if (summary) {
    const got = summary.score;
    const missed = summary.total - summary.score;
    const pct = summary.total > 0 ? Math.round((got / summary.total) * 100) : 0;
    const message = pct >= 80 ? 'Great recall!' : pct >= 60 ? 'Solid effort.' : 'Keep reviewing.';
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <div className="label-mono mb-1">Deck complete</div>
          <div className="text-2xl text-[var(--text-primary)]">{message}</div>
        </header>

        <div className="surface p-6 flex gap-8 justify-center">
          <div className="text-center">
            <div className="font-mono text-4xl text-[var(--accent-teal)]">{got}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">Got it</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-4xl text-[var(--accent-coral)]">{missed}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">Missed</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-4xl text-[var(--accent-amber)]">{summary.xpEarned}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">XP</div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => { setSummary(null); start(); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border)] text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]"
          >
            <RotateCcw size={14} /> Study again
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-teal)] text-[#0d0f14] font-mono text-sm font-bold"
          >
            Dashboard <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  // Config screen
  return (
    <div className="space-y-6 max-w-2xl">
      <header className="flex items-center gap-3">
        <Layers size={22} className="text-[var(--accent-teal)]" />
        <div>
          <div className="text-2xl text-[var(--text-primary)]">Flashcard Deck</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">
            Reinforce definitions, terms, and key concepts.
          </div>
        </div>
      </header>

      <section className="surface p-5">
        <div className="label-mono mb-3">Domains</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {ALL_DOMAINS.map((d) => (
            <Pill
              key={d.id}
              active={domains.includes(d.id)}
              onClick={() => toggle(domains, d.id, setDomains)}
            >
              {d.label}
            </Pill>
          ))}
        </div>
        <div className="mt-3 text-xs font-mono text-[var(--text-muted)]">
          {available} card{available !== 1 ? 's' : ''} available
        </div>
      </section>

      <section className="surface p-5">
        <div className="label-mono mb-3">Deck size</div>
        <div className="flex gap-2 flex-wrap">
          {DECK_SIZES.map((n) => (
            <Pill key={n} active={deckSize === n} onClick={() => setDeckSize(n)}>
              {n} cards
            </Pill>
          ))}
        </div>
      </section>

      <div className="flex justify-between items-center">
        <Link to="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          ← Back
        </Link>
        <button
          onClick={start}
          disabled={domains.length === 0 || available === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--accent-teal)] text-[#0d0f14] font-mono text-sm font-bold disabled:opacity-40"
        >
          <Play size={14} /> Start deck
        </button>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-2 rounded-lg border text-sm font-mono transition-colors',
        active
          ? 'bg-[var(--bg-elevated)] border-[var(--border-accent)] text-[var(--text-primary)]'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
