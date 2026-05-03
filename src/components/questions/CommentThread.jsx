import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useSupabase } from '../../hooks/useSupabase.js';

function relativeTime(iso) {
  const ts = new Date(iso).getTime();
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CommentThread({ questionId }) {
  const supabase = useSupabase();
  const { user } = useUser();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: comments } = await supabase
      .from('patch_question_comments')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true });

    if (comments && comments.length > 0) {
      const userIds = [...new Set(comments.map((c) => c.user_id))];
      const { data: users } = await supabase.from('patch_users').select('id, username').in('id', userIds);
      const userMap = Object.fromEntries((users || []).map((u) => [u.id, u.username]));
      setComments(comments.map((c) => ({ ...c, username: userMap[c.user_id] || 'someone' })));
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 500 || !user) return;
    setSubmitting(true);
    const optimistic = {
      id: `temp-${Date.now()}`,
      question_id: questionId,
      user_id: user.id,
      body: trimmed,
      created_at: new Date().toISOString(),
      username: user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'you',
    };
    setComments((prev) => [...prev, optimistic]);
    setBody('');
    const { data, error } = await supabase
      .from('patch_question_comments')
      .insert({ question_id: questionId, user_id: user.id, body: trimmed })
      .select()
      .single();
    if (error) {
      console.error(error);
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
    } else if (data) {
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? { ...data, username: optimistic.username } : c))
      );
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-[var(--text-secondary)]" />
        <div className="label-mono">Community Notes ({comments.length})</div>
      </div>

      {loading && <div className="text-xs text-[var(--text-muted)]">Loading…</div>}

      {!loading && comments.length === 0 && (
        <div className="text-xs text-[var(--text-muted)] italic mb-3">
          No notes yet — share your reasoning or a memory aid.
        </div>
      )}

      {!loading && comments.length > 0 && (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[var(--accent-teal)] text-xs">{c.username}</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{relativeTime(c.created_at)}</span>
              </div>
              <div className="text-[var(--text-primary)] whitespace-pre-wrap mt-0.5">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Add a note (max 500 chars)…"
          className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-teal)] resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{body.length}/500</span>
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs bg-[var(--accent-teal)] text-[#0d0f14] disabled:opacity-40"
          >
            <Send size={12} />
            Post
          </button>
        </div>
      </form>
    </div>
  );
}
