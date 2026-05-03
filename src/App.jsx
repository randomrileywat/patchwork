import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';
import AppShell from './components/layout/AppShell.jsx';
import Dashboard from './views/Dashboard.jsx';
import PracticeSession from './views/PracticeSession.jsx';
import FlashcardSession from './views/FlashcardSession.jsx';
import WeakAreaArena from './views/WeakAreaArena.jsx';
import ReviewQueue from './views/ReviewQueue.jsx';
import Leaderboard from './views/Leaderboard.jsx';
import Admin from './views/Admin.jsx';
import { clerkDarkAppearance } from './lib/clerkTheme.js';

function AuthPage() {
  const { pathname } = useLocation();
  const isSignUp = pathname.startsWith('/sign-up');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="w-10 h-10">
            <path
              d="M2 16 L7 16 L9 8 L13 24 L17 6 L21 26 L25 12 L30 16"
              fill="none"
              stroke="var(--accent-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="font-mono font-bold tracking-wider text-2xl text-[var(--text-primary)]">PATCHWORK</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Adaptive Study</div>
          </div>
        </div>

        {/* Context text */}
        {isSignUp ? (
          <div className="text-center max-w-xs">
            <p className="text-[var(--text-primary)] font-semibold text-lg">First time?</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Create an account to track your progress, earn XP, and start adaptive learning.</p>
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">Welcome back. Sign in to continue.</p>
        )}

        {/* Clerk component */}
        <Routes>
          <Route path="/sign-up/*" element={<SignUp appearance={clerkDarkAppearance} routing="hash" signInUrl="https://rileywatson.dev/patchwork/" />} />
          <Route path="*" element={<SignIn appearance={clerkDarkAppearance} routing="hash" signUpUrl="https://rileywatson.dev/patchwork/#/sign-up" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedIn>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/practice" element={<PracticeSession />} />
            <Route path="/flashcards" element={<FlashcardSession />} />
            <Route path="/arena" element={<WeakAreaArena />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </SignedIn>
      <SignedOut>
        <AuthPage />
      </SignedOut>
    </>
  );
}
