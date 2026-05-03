import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Play, RotateCcw, ChevronRight, Check, Clock } from 'lucide-react';
import questions from '../data/questions.json';
import { pickRandomFromFilters } from '../utils/questionPicker.js';
import { useProgressStore } from '../store/progressStore.js';

const ALL_DOMAINS = [
  { id: 'domain-a', label: 'A · Needs Assessment' },
  { id: 'domain-b', label: 'B · Project Documentation' },
  { id: 'domain-c', label: 'C · AV Design' },
  { id: 'domain-d', label: 'D · Project Implementation' },
];

const DECK_SIZES = [10, 20, 30, 50];
const FLASHCARD_POOL = questions.filter((q) => q.type === 'flashcard');

function computeBreakdown(responses) {
  const bd = {};
  responses.forEach(({ subtopic, correct }) => {
    if (!bd[subtopic]) bd[subtopic] = { correct: 0, total: 0 };
    bd[subtopic].total += 1;
    if (correct) bd[subtopic].correct += 1;
  });
  return bd;
}

export default function FlashcardSession() {
  const finishSession = useProgressStore((s) => s.finishSession);
  const markSessionStart = useProgressStore((s) => s.markSessionStart);
  const recentIds = useProgressStore((s) => s.recentQuestionIds);
  const recordAttempt = useProgressStore((s) => s.recordAttempt);

  // ── Config state ─────────────────────────────────────────────────────────
  const [domains, setDomains] = useState(['domain-a', 'domain-b', 'domain-c', 'domain-d']);
  const [deckSize, setDeckSize] = useState(20);

  // ── Study state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('config'); // 'config' | 'study' | 'summary'
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewLater, setReviewLater] = useState([]);
  const [totalGot, setTotalGot] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [responses, setResponses] = useState([]);
  const [isReviewRound, setIsReviewRound] = useState(false);

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
      alert('No flashcards match those domains.');
      return;
    }
    markSessionStart();
    setCards(picked);
    setIdx(0);
    setFlipped(false);
    setReviewLater([]);
    setTotalGot(0);
    setTotalAnswered(0);
    setTotalXP(0);
    setResponses([]);
    setIsReviewRound(false);
    setPhase('study');
  };

  const respond = (correct) => {
    const card = cards[idx];
    const result = recordAttempt({ question: card, correct, multiplier: 1 });
    const newResp = {
      questionId: card.id,
      correct,
      skipped: false,
      xpDelta: result.xpDelta,
      subtopic: card.subtopic,
      domain: card.domain,
    };
    const newResponses = [...responses, newResp];
    const newLater = correct ? reviewLater : [...reviewLater, card];
    const newGot = totalGot + (correct ? 1 : 0);
    const newAnswered = totalAnswered + 1;
    const newXP = totalXP + (result.xpDelta || 0);

    setResponses(newResponses);
    setReviewLater(newLater);
    setTotalGot(newGot);
    setTotalAnswered(newAnswered);
    setTotalXP(newXP);

    const nextIdx = idx + 1;
    if (nextIdx >= cards.length) {
      if (!isReviewRound) {
        finishSession({
          score: newGot,
          total: newAnswered,
          topicBreakdown: computeBreakdown(newResponses),
          xpEarned: newXP,
          mode: 'flashcard',
        });
      }
      setPhase('summary');
    } else {
      setIdx(nextIdx);
      setFlipped(false);
    }
  };

  const startReviewRound = () => {
    setCards(reviewLater);
    setReviewLater([]);
    setIdx(0);
    setFlipped(false);
    setResponses([]);
    setIsReviewRound(true);
    setPhase('study');
  };

  const reset = () => {
    setPhase('config');
    setCards([]);
    setIdx(0);
    setFlipped(false);
    setReviewLater([]);
    setTotalGot(0);
    setTotalAnswered(0);
    setTotalXP(0);
    setResponses([]);
    setIsReviewRound(false);
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    const pct = totalAnswered > 0 ? Math.round((totalGot / totalAnswered) * 100) : 0;
    const missed = totalAnswered - totalGot;
    const message =
      pct >= 85 ? 'Excellent recall!' : pct >= 65 ? 'Good progress.' : 'Keep at it.';

    return (
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <div className="label-mono mb-1">
            {isReviewRound ? 'Review round done' : 'Deck complete'}
          </div>
          <div className="text-2xl text-[var(--text-primary)]">{message}</div>
        </header>

        <div className="surface p-6 space-y-5">
          {/* Got it / Review split bar */}
          <div className="h-3 rounded-full overflow-hidden flex">
            <div
              className="bg-[var(--accent-teal)] transition-all duration-700"
              style={{ width: `${pct}%`, borderRadius: pct === 100 ? '9999px' : '9999px 0 0 9999px' }}
            />
            <div
              className="bg-[var(--accent-amber)] transition-all duration-700"
              style={{ width: `${100 - pct}%`, borderRadius: pct === 0 ? '9999px' : '0 9999px 9999px 0' }}
            />
          </div>

          <div className="flex justify-around">
            <div className="text-center">
              <div className="font-mono text-3xl text-[var(--accent-teal)]">{totalGot}</div>
              <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <Check size={11} /> Got it
              </div>
            </div>
            <div className="w-px bg-[var(--border)]" />
            <div className="text-center">
              <div className="font-mono text-3xl text-[var(--accent-amber)]">{missed}</div>
              <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <Clock size={11} /> Review later
              </div>
            </div>
            <div className="w-px bg-[var(--border)]" />
            <div className="text-center">
              <div className="font-mono text-3xl text-[var(--accent-teal)]">{totalXP}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">XP</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {reviewLater.length > 0 && (
            <button
              onClick={startReviewRound}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm font-bold transition-colors"
              style={{ border: '2px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Clock size={14} /> Review {reviewLater.length} card
              {reviewLater.length !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border)] text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors"
          >
            <RotateCcw size={14} /> New deck
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

  // ── Study ─────────────────────────────────────────────────────────────────
  if (phase === 'study') {
    const card = cards[idx];
    const remaining = cards.length - idx - 1;
    const progressPct = (idx / cards.length) * 100;
    const accentColor = isReviewRound ? 'var(--accent-amber)' : 'var(--accent-teal)';

    return (
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-sm font-mono text-[var(--text-secondary)]">
            <Layers size={15} style={{ color: accentColor }} />
            {isReviewRound ? 'Review round' : 'Study deck'}
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {idx + 1} / {cards.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden mb-8">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%`, background: accentColor }}
          />
        </div>

        {/* Card stack */}
        <div className="relative mb-6" style={{ height: 240 }}>
          {remaining >= 2 && (
            <div
              className="absolute inset-0 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]"
              style={{ transform: 'translateY(10px) scale(0.93)', zIndex: 1 }}
            />
          )}
          {remaining >= 1 && (
            <div
              className="absolute inset-0 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]"
              style={{ transform: 'translateY(5px) scale(0.965)', zIndex: 2 }}
            />
          )}

          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col items-center justify-center p-8 text-center cursor-pointer select-none transition-all duration-200"
            style={{
              zIndex: 3,
              opacity: flipped ? 0 : 1,
              transform: flipped ? 'scale(0.97)' : 'scale(1)',
              pointerEvents: flipped ? 'none' : 'auto',
            }}
            onClick={() => setFlipped(true)}
          >
            <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-5">
              {card.subtopic?.replace(/-/g, ' ')} · tap to reveal
            </div>
            <div className="text-xl font-mono text-[var(--text-primary)] leading-snug">
              {card.front}
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl flex flex-col items-center justify-center p-8 text-center select-none transition-all duration-200"
            style={{
              zIndex: 3,
              border: `1px solid ${accentColor}`,
              background: 'var(--bg-elevated)',
              opacity: flipped ? 1 : 0,
              transform: flipped ? 'scale(1)' : 'scale(0.97)',
              pointerEvents: flipped ? 'auto' : 'none',
            }}
          >
            <div
              className="text-[9px] font-mono uppercase tracking-widest mb-5"
              style={{ color: accentColor }}
            >
              Definition
            </div>
            <div className="text-base text-[var(--text-primary)] leading-relaxed">{card.back}</div>
          </div>
        </div>

        {/* Response buttons — appear after flip */}
        <div
          className="flex gap-3 transition-all duration-200"
          style={{
            opacity: flipped ? 1 : 0,
            transform: flipped ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: flipped ? 'auto' : 'none',
          }}
        >
          <button
            onClick={() => respond(false)}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-mono font-bold text-sm transition-colors"
            style={{ border: '2px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Clock size={15} /> Review Later
          </button>
          <button
            onClick={() => respond(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-mono font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent-teal)', color: '#0d0f14' }}
          >
            <Check size={15} /> Got it
          </button>
        </div>

        {remaining > 0 && (
          <div className="text-center mt-4 text-[11px] font-mono text-[var(--text-muted)]">
            {remaining} card{remaining !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>
    );
  }

  // ── Config ────────────────────────────────────────────────────────────────
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
        <Link
          to="/"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
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
