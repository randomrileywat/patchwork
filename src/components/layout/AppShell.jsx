import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import { useProgressHydrator } from '../../hooks/useProgressHydrator.js';
import { useProgressStore } from '../../store/progressStore.js';
import Onboarding from '../../views/Onboarding.jsx';

export default function AppShell({ children }) {
  useProgressHydrator();
  const hydrated = useProgressStore((s) => s.hydrated);
  const sessions = useProgressStore((s) => s.sessions);

  // Not yet hydrated from Supabase
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] text-[var(--text-muted)] font-mono text-sm">
        Syncing your progress…
      </div>
    );
  }

  // First-time user — show onboarding (no sidebar/nav)
  if (sessions.length === 0) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 sm:py-8 pb-20 md:pb-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
