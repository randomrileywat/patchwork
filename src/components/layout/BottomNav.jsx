import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, Swords, BookmarkCheck, Trophy } from 'lucide-react';
import { useProgressStore } from '../../store/progressStore.js';

const navLinks = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/practice', label: 'Practice', icon: Target },
  { to: '/arena', label: 'Arena', icon: Swords },
  { to: '/review', label: 'Review', icon: BookmarkCheck, badgeKey: 'review' },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy },
];

export default function BottomNav() {
  const { reviewQueue } = useProgressStore();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[var(--bg-surface)] border-t border-[var(--border)] flex items-center justify-around h-14 safe-bottom">
      {navLinks.map(({ to, label, icon: Icon, end, badgeKey }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-mono px-3 py-1 transition-colors relative ${
              isActive ? 'text-[var(--accent-teal)]' : 'text-[var(--text-secondary)]'
            }`
          }
        >
          <Icon size={20} />
          {label}
          {badgeKey === 'review' && reviewQueue.length > 0 && (
            <span className="absolute top-0 right-2 text-[9px] font-mono w-4 h-4 flex items-center justify-center rounded-full bg-[var(--accent-coral)] text-[#0d0f14]">
              {reviewQueue.length > 9 ? '9+' : reviewQueue.length}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
