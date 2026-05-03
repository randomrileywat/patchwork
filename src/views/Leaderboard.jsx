import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Trophy, RefreshCw, Flame } from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase.js';

const SUBTOPIC_LABEL = {
  'audio-design': 'Audio',
  'video-design': 'Video',
  'signal-flow': 'Signal Flow',
  'control-systems': 'Control',
  'networking': 'Networking',
  'rack-design': 'Rack',
  'power-cabling': 'Power',
  'documentation': 'Docs',
  'needs-assessment': 'Needs',
  'project-implementation': 'Implementation',
};

export default function Leaderboard() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_leaderboard');
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top10 = rows.slice(0, 10);
  const myRow = rows.find((r) => r.user_id === user?.id);
  const myRowOutsideTop = myRow && Number(myRow.rank) > 10 ? myRow : null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-mono">Community</div>
          <h1 className="font-mono text-3xl mt-1 flex items-center gap-3">
            <Trophy size={28} className="text-[var(--accent-amber)]" />
            Leaderboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Top study minds. Climb the ranks by stacking XP, streaks, and mastered topics.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="surface p-4 border border-[var(--accent-coral)]">
          <div className="text-sm text-[var(--accent-coral)] font-mono">Failed to load leaderboard</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{error}</div>
        </div>
      )}

      {!loading && !error && rows.length < 2 && (
        <div className="surface p-8 text-center">
          <div className="text-[var(--text-secondary)]">
            Be the first to top the board — complete a session to appear here.
          </div>
        </div>
      )}

      {rows.length >= 2 && (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 w-14">#</th>
                <th className="text-left px-4 py-3">Studier</th>
                <th className="text-right px-4 py-3">XP</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Streak</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Top topic</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Expert</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r) => (
                <Row key={r.user_id} row={r} isMe={r.user_id === user?.id} />
              ))}
              {myRowOutsideTop && (
                <>
                  <tr>
                    <td colSpan={6} className="text-center text-[10px] font-mono text-[var(--text-muted)] py-2 border-t border-[var(--border)]">
                      ··· your rank ···
                    </td>
                  </tr>
                  <Row row={myRowOutsideTop} isMe />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ row, isMe }) {
  return (
    <tr
      className={[
        'border-b border-[var(--border)] last:border-b-0',
        isMe ? 'bg-[var(--bg-elevated)] ring-1 ring-inset ring-[var(--accent-teal)]' : '',
      ].join(' ')}
    >
      <td className="px-4 py-3 font-mono text-[var(--text-muted)]">{row.rank}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{row.username}{isMe && <span className="ml-2 text-[10px] font-mono text-[var(--accent-teal)]">YOU</span>}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--accent-teal)]">{(row.total_xp || 0).toLocaleString()}</td>
      <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">
        <span className={`inline-flex items-center gap-1 ${row.current_streak > 0 ? 'text-[var(--accent-amber)]' : 'text-[var(--text-muted)]'}`}>
          <Flame size={12} />
          {row.current_streak || 0}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)] hidden md:table-cell">
        {SUBTOPIC_LABEL[row.top_topic] || row.top_topic || '—'}
      </td>
      <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
        {row.expert_count > 0 ? (
          <span className="px-2 py-0.5 rounded bg-[var(--accent-teal)] text-[#0d0f14] text-xs">{row.expert_count}</span>
        ) : (
          <span className="text-[var(--text-muted)]">0</span>
        )}
      </td>
    </tr>
  );
}
