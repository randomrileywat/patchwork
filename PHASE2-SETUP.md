# Patchwork — Phase 2 Setup

Phase 2 introduces multi-user authentication (Clerk) and a cloud database (Supabase),
replacing localStorage. Follow these steps in order or the deployed site will not work.

## 1. Run the database schema

Open your Supabase project → **SQL Editor** → paste the contents of
[supabase/schema.sql](supabase/schema.sql) → Run. It is idempotent; safe to re-run.

## 2. Connect Clerk ↔ Supabase (native integration)

This uses the **2025 native** integration (not the deprecated JWT template).

1. In Clerk dashboard, open <https://dashboard.clerk.com/setup/supabase> and follow
   the Supabase connector wizard. It will guide you to step 2 in Supabase.
2. In Supabase dashboard → **Authentication → Sign In / Up → Third-Party Auth** →
   **Add provider → Clerk**. Paste the Clerk Frontend API URL Clerk gave you.
3. Save. That's it — no JWT templates, no shared secrets to copy.

## 3. Local environment

```powershell
Copy-Item .env.example .env
```

Then fill in `.env`:

| Var | Where to find it |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys → Publishable key (`pk_test_…`) |
| `VITE_SUPABASE_URL`         | Supabase dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY`    | Supabase dashboard → Settings → API → `anon public` key |
| `VITE_SUPABASE_SERVICE_KEY` | Supabase → Settings → API → `service_role` key. **Local only.** |
| `VITE_ADMIN_USER_ID`        | Sign in once, then copy your Clerk user id (`user_…`) from Clerk dashboard |

> **Never commit `.env` or push the service role key to GitHub.** `.env` is gitignored.

```powershell
npm run dev
```

Sign up. The app upserts your profile to `users`, hydrates the (empty) progress store,
and you're rolling.

## 4. GitHub Pages deployment

In the GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**,
add **all four**:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_USER_ID` (optional — only needed if you want `/admin` to render even a 403 redirect for non-admins)

> Do **not** add `VITE_SUPABASE_SERVICE_KEY` to GitHub. Production `/admin` will show
> a "service key unavailable" message, which is the correct behavior.

Push to `main` and the workflow will build with these vars baked in.

## 5. What changed

- **Auth wall.** Unauthenticated visitors see the Clerk sign-in screen.
- **Progress is in Supabase.** localStorage is no longer used. The first ~half-second
  after sign-in shows "Syncing your progress…" while we hydrate.
- **Leaderboard** at `/leaderboard` ranks the top 100 by total XP.
- **Community Notes** appear under each question after you answer it.
- **Report Question** button (next to Flag) opens a moderation modal.
- **`/admin` route** lets the admin user resolve reports and remove comments
  (local dev only — service key never ships to prod).

## Troubleshooting

- **"Syncing…" spinner never resolves**: check browser console. Most often it's a
  missing/wrong `VITE_SUPABASE_*` var or you skipped step 1 (schema).
- **Leaderboard is empty**: needs ≥ 2 users and at least one finished session.
- **Permission denied / RLS errors in console**: re-run schema (idempotent) and
  confirm Clerk↔Supabase third-party auth provider is added (step 2).
