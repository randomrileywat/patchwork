import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import { useProgressHydrator } from '../../hooks/useProgressHydrator.js';
import { useProgressStore } from '../../store/progressStore.js';

export default function AppShell({ children }) {
  useProgressHydrator();
  const hydrated = useProgressStore((s) => s.hydrated);

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 sm:py-8 pb-20 md:pb-8">
          {hydrated ? (
            children
          ) : (
            <div className="flex items-center justify-center min-h-[60vh] text-[var(--text-muted)] font-mono text-sm">
              Syncing your progress…
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
