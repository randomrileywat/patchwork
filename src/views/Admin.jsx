import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Shield, AlertTriangle, MessageSquare, Trash2, Check, Copy } from 'lucide-react';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import questionsData from '../data/questions.json';

const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;

const QUESTIONS_BY_ID = Object.fromEntries(
  (questionsData.questions || questionsData || []).map((q) => [q.id, q])
);

export default function Admin() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState('reports');

  if (!isLoaded) return null;
  if (!ADMIN_USER_ID || user?.id !== ADMIN_USER_ID) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <header>
        <div className="label-mono">Moderation</div>
        <h1 className="font-mono text-3xl mt-1 flex items-center gap-3">
          <Shield size={26} className="text-[var(--accent-coral)]" />
          Admin
        </h1>
      </header>

      {!supabaseAdmin && (
        <div className="surface p-4 border border-[var(--accent-amber)]">
          <div className="text-sm text-[var(--accent-amber)] font-mono">Admin features unavailable</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            This build was compiled without VITE_SUPABASE_SERVICE_KEY (correct for production).
            Run locally with a populated <code className="font-mono">.env</code> to access reports and comments.
          </div>
        </div>
      )}

      {supabaseAdmin && (
        <>
          <div className="flex gap-2 border-b border-[var(--border)]">
            <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={AlertTriangle}>
              Open Reports
            </TabButton>
            <TabButton active={tab === 'comments'} onClick={() => setTab('comments')} icon={MessageSquare}>
              Comments
            </TabButton>
          </div>

          {tab === 'reports' && <ReportsPanel />}
          {tab === 'comments' && <CommentsPanel />}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-mono border-b-2 transition-colors ${
        active
          ? 'border-[var(--accent-teal)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function ReportsPanel() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabaseAdmin
      .from('patch_question_reports')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = reports.reduce((acc, r) => {
    if (!acc[r.question_id]) acc[r.question_id] = [];
    acc[r.question_id].push(r);
    return acc;
  }, {});

  const resolve = async (id) => {
    await supabaseAdmin
      .from('patch_question_reports')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  const resolveAllForQuestion = async (qid) => {
    await supabaseAdmin
      .from('patch_question_reports')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('question_id', qid)
      .eq('resolved', false);
    load();
  };

  const copyQuestion = (qid) => {
    const q = QUESTIONS_BY_ID[qid];
    navigator.clipboard.writeText(JSON.stringify(q, null, 2));
  };

  if (loading) return <div className="text-sm text-[var(--text-muted)]">Loading…</div>;
  if (reports.length === 0) {
    return (
      <div className="surface p-6 text-center text-[var(--text-secondary)]">No open reports.</div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([qid, items]) => {
        const q = QUESTIONS_BY_ID[qid];
        return (
          <div key={qid} className="surface p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-coral)] text-[#0d0f14]">
                    {items.length}
                  </span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">{qid}</span>
                </div>
                <div className="text-sm text-[var(--text-primary)]">
                  {q?.question || q?.front || q?.scenario || <span className="italic text-[var(--text-muted)]">Question not found in current data set</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copyQuestion(qid)}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <Copy size={12} /> Copy
                </button>
                <button onClick={() => resolveAllForQuestion(qid)}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded bg-[var(--accent-teal)] text-[#0d0f14]">
                  <Check size={12} /> Resolve all
                </button>
              </div>
            </div>
            <ul className="space-y-2 border-t border-[var(--border)] pt-3">
              {items.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex-1">
                    <span className="font-mono text-xs text-[var(--accent-amber)]">{r.reason}</span>
                    {r.note && <span className="text-[var(--text-secondary)] ml-2">— {r.note}</span>}
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                      {new Date(r.created_at).toLocaleString()} · {r.user_id.slice(-8)}
                    </div>
                  </div>
                  <button onClick={() => resolve(r.id)}
                    className="text-xs font-mono px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent-teal)]">
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CommentsPanel() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabaseAdmin
      .from('patch_question_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (rows && rows.length > 0) {
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: users } = await supabaseAdmin.from('patch_users').select('id, username').in('id', ids);
      const map = Object.fromEntries((users || []).map((u) => [u.id, u.username]));
      setComments(rows.map((r) => ({ ...r, username: map[r.user_id] || r.user_id.slice(-8) })));
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Delete this comment?')) return;
    await supabaseAdmin.from('patch_question_comments').delete().eq('id', id);
    load();
  };

  if (loading) return <div className="text-sm text-[var(--text-muted)]">Loading…</div>;
  if (comments.length === 0) return <div className="surface p-6 text-center text-[var(--text-secondary)]">No comments yet.</div>;

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="surface p-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--accent-teal)]">{c.username}</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{new Date(c.created_at).toLocaleString()}</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">{c.question_id}</span>
            </div>
            <div className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{c.body}</div>
          </div>
          <button onClick={() => remove(c.id)}
            className="text-xs font-mono px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent-coral)] hover:border-[var(--accent-coral)]">
            <Trash2 size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}
