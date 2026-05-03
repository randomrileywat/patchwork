import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useSupabase } from '../../hooks/useSupabase.js';

const REASONS = [
  { value: 'incorrect', label: 'Answer is incorrect' },
  { value: 'ambiguous', label: 'Question is ambiguous' },
  { value: 'outdated', label: 'Information is outdated' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ questionId, onClose, onSubmitted }) {
  const supabase = useSupabase();
  const { user } = useUser();
  const [reason, setReason] = useState('incorrect');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('patch_question_reports').insert({
      question_id: questionId,
      user_id: user.id,
      reason,
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      console.error(error);
      onSubmitted?.({ ok: false, error: error.message });
    } else {
      onSubmitted?.({ ok: true });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="surface w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-[var(--accent-amber)]" />
          <h2 className="font-mono text-lg">Report Question</h2>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <div className="label-mono">Reason</div>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[var(--accent-teal)]"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="label-mono mb-1">Note (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="What would you change?"
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-teal)] resize-none"
            />
            <div className="text-[10px] font-mono text-[var(--text-muted)] text-right mt-1">{note.length}/300</div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded font-mono text-xs border border-[var(--border)] text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded font-mono text-xs bg-[var(--accent-coral)] text-[#0d0f14] disabled:opacity-40"
            >
              {submitting ? 'Sending…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
