import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import questions from '../data/questions.json';
import { pickRandomFromFilters } from '../utils/questionPicker.js';
import { useProgressStore } from '../store/progressStore.js';
import SessionRunner from '../components/questions/SessionRunner.jsx';
import MasteryBadge from '../components/shared/MasteryBadge.jsx';
import { masteryLevelFromScore, computeRollingScore } from '../utils/scoring.js';

const ALL_DOMAINS = [
  { id: 'domain-a', label: 'A · Needs Assessment', subtopics: ['needs-assessment'] },
  { id: 'domain-b', label: 'B · Project Documentation', subtopics: ['documentation'] },
  { id: 'domain-c', label: 'C · AV Design', subtopics: ['audio-design', 'video-design', 'signal-flow', 'control-systems', 'networking', 'rack-design', 'power-cabling'] },
  { id: 'domain-d', label: 'D · Project Implementation', subtopics: ['project-implementation'] },
];

const TYPE_OPTIONS = [
  { id: 'mc', label: 'Multiple Choice' },
  { id: 'mc-multi', label: 'Multi-Select' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'drag-match', label: 'Drag-Match' },
];

const COUNT_OPTIONS = [5, 10, 20, 30];
const DIFF_OPTIONS = [
  { id: 'all', label: 'All', value: [1, 2, 3] },
  { id: '1', label: '1 only', value: [1] },
  { id: '2', label: '2 only', value: [2] },
  { id: '3', label: '3 only', value: [3] },
  { id: '23', label: '2 + 3', value: [2, 3] },
];

export default function PracticeSession() {
  const navigate = useNavigate();
  const finishSession = useProgressStore((s) => s.finishSession);
  const markSessionStart = useProgressStore((s) => s.markSessionStart);
  const recentIds = useProgressStore((s) => s.recentQuestionIds);

  const [domains, setDomains] = useState(['domain-a', 'domain-b', 'domain-c', 'domain-d']);
  const [subtopics, setSubtopics] = useState([]);
  const [types, setTypes] = useState(['mc', 'mc-multi', 'scenario', 'drag-match']);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('all');
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);

  const toggle = (arr, val, setter) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const start = () => {
    const filters = {
      domains,
      subtopics: subtopics.length > 0 ? subtopics : undefined,
      types,
      difficulty: DIFF_OPTIONS.find((d) => d.id === difficulty).value,
    };
    const picked = pickRandomFromFilters(questions, filters, count, recentIds);
    if (picked.length === 0) {
      alert('No questions match those filters. Try widening them.');
      return;
    }
    markSessionStart();
    setSession({ questions: picked });
    setSummary(null);
  };

  const handleFinish = (result) => {
    const sessionRecord = finishSession({ ...result, mode: 'practice' });
    setSummary({ ...result, sessionRecord });
    setSession(null);
  };

  if (session) {
    return (
      <div className="max-w-3xl mx-auto">
        <SessionRunner
          questions={session.questions}
          mode="practice"
          onFinish={handleFinish}
        />
      </div>
    );
  }

  if (summary) return <SummaryScreen summary={summary} onAgain={() => { setSummary(null); start(); }} onArena={() => navigate('/arena')} onHome={() => navigate('/')} />;

  // Pre-session config
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <div className="text-2xl">Configure practice session</div>
        <div className="text-sm text-[var(--text-secondary)] mt-1">Pick the topics, types, and difficulty to focus on.</div>
      </header>

      <section className="surface p-5">
        <div className="label-mono mb-3">Domains</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {ALL_DOMAINS.map((d) => (
            <Pill key={d.id} active={domains.includes(d.id)} onClick={() => toggle(domains, d.id, setDomains)}>
              {d.label}
            </Pill>
          ))}
        </div>

        <div className="label-mono mt-5 mb-3">Sub-topics (Domain C — optional refinement)</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ALL_DOMAINS[2].subtopics.map((st) => (
            <Pill key={st} active={subtopics.includes(st)} onClick={() => toggle(subtopics, st, setSubtopics)}>
              {st.replace(/-/g, ' ')}
            </Pill>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <div className="label-mono mb-3">Question types</div>
        <div className="grid sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((t) => (
            <Pill key={t.id} active={types.includes(t.id)} onClick={() => toggle(types, t.id, setTypes)}>
              {t.label}
            </Pill>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <div className="label-mono mb-3">Question count</div>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((c) => (
            <Pill key={c} active={count === c} onClick={() => setCount(c)}>{c}</Pill>
          ))}
        </div>

        <div className="label-mono mt-5 mb-3">Difficulty</div>
        <div className="flex flex-wrap gap-2">
          {DIFF_OPTIONS.map((d) => (
            <Pill key={d.id} active={difficulty === d.id} onClick={() => setDifficulty(d.id)}>{d.label}</Pill>
          ))}
        </div>

        <div className="label-mono mt-5 mb-3">Certification</div>
        <select disabled className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text-secondary)] cursor-not-allowed">
          <option>CTS-D</option>
          <option>CCNA (coming soon)</option>
        </select>
      </section>

      <div className="flex justify-between items-center">
        <Link to="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back</Link>
        <button onClick={start}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--accent-teal)] text-[#0d0f14] font-mono text-sm font-bold">
          <Play size={14} />
          Start session
        </button>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
        active
          ? 'bg-[var(--bg-elevated)] border-[var(--border-accent)] text-[var(--text-primary)]'
          : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]'
      }`}>
      {children}
    </button>
  );
}

function SummaryScreen({ summary, onAgain, onArena, onHome }) {
  const { score, total, xpEarned, topicBreakdown } = summary;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const tone = pct >= 80 ? 'var(--accent-teal)' : pct >= 60 ? 'var(--accent-amber)' : 'var(--accent-coral)';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="surface p-8 text-center">
        <div className="label-mono mb-2">Session complete</div>
        <div className="text-6xl font-mono font-bold" style={{ color: tone }}>{score} / {total}</div>
        <div className="text-sm text-[var(--text-secondary)] mt-2">{pct}% accuracy · +{xpEarned} XP earned</div>
      </div>

      <div className="surface p-5">
        <div className="label-mono mb-3">Topic breakdown</div>
        <ul className="space-y-2">
          {Object.entries(topicBreakdown).map(([st, b]) => {
            const p = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
            return (
              <li key={st} className="flex items-center gap-3 text-sm">
                <span className="w-44 text-[var(--text-secondary)] font-mono text-xs">{st}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div className="h-full" style={{ width: `${p}%`, background: tone }} />
                </div>
                <span className="w-20 text-right font-mono text-xs">{b.correct}/{b.total}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <button onClick={onAgain} className="px-5 py-2.5 rounded-lg bg-[var(--accent-teal)] text-[#0d0f14] font-mono text-sm font-bold">Practice Again</button>
        <button onClick={onArena} className="px-5 py-2.5 rounded-lg border border-[var(--accent-amber)] text-[var(--accent-amber)] font-mono text-sm">Weak Area Arena</button>
        <button onClick={onHome} className="px-5 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-mono text-sm">Dashboard</button>
      </div>
    </div>
  );
}
