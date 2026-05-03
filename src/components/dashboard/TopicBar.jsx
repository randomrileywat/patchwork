import MasteryBadge from '../shared/MasteryBadge.jsx';
import { MASTERY_LEVELS, MIN_ATTEMPTS_FOR_MASTERY } from '../../utils/scoring.js';

export default function TopicBar({ name, score, attempts, level }) {
  const hasData = attempts >= MIN_ATTEMPTS_FOR_MASTERY;
  const masteryPct = hasData ? Math.round(score * 100) : 0;
  const progressPct = hasData ? masteryPct : Math.round((attempts / MIN_ATTEMPTS_FOR_MASTERY) * 100);
  const color = `var(${MASTERY_LEVELS[level || 0].colorVar})`;
  const barColor = hasData ? color : 'var(--text-muted)';

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-44 shrink-0">
        <div className="text-sm text-[var(--text-primary)]">{name}</div>
        <div className="mt-0.5">
          {hasData
            ? <MasteryBadge level={level} compact />
            : <span className="text-[9px] font-mono text-[var(--text-muted)]">{attempts}/{MIN_ATTEMPTS_FOR_MASTERY} to unlock</span>
          }
        </div>
      </div>
      <div className="flex-1">
        <div className="h-2.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, background: attempts > 0 ? barColor : 'transparent' }}
          />
        </div>
      </div>
      <div className="w-20 text-right font-mono text-sm" style={{ color: attempts > 0 ? barColor : 'var(--text-muted)' }}>
        {hasData ? `${masteryPct}%` : attempts > 0 ? `${attempts}/${MIN_ATTEMPTS_FOR_MASTERY}` : '—'}
      </div>
      <div className="w-16 text-right text-[11px] text-[var(--text-muted)] font-mono">
        {attempts} att
      </div>
    </div>
  );
}
