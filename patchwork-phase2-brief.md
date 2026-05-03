# Patchwork — Phase 2 Coding Brief
**Multi-User Auth · Supabase Database · Leaderboard · Question Comments & Reports**

---

## 1. Overview

Phase 2 transforms Patchwork from a single-user local tool into a shared study platform. Users sign in with Clerk, their progress is stored in Supabase, and they can interact with the question bank through comments and reports. A leaderboard adds competitive motivation.

**What is NOT changing:**
- The React + Vite + Tailwind stack
- The dark theme and visual design
- The question bank JSON format and all existing question types
- The gamification mechanics (XP, mastery levels, streaks, weak area arena)
- The overall layout and routing structure

**What IS changing:**
- `localStorage` → Supabase Postgres for all progress/session data
- New auth layer via Clerk (wraps the entire app)
- New `/leaderboard` view
- New question comment threads and report flow
- New `/admin` route for you to manage reports

---

## 2. Integration Architecture

### Clerk + Supabase (2025 Native Integration)

> ⚠️ **IMPORTANT:** Do NOT use the old Clerk JWT template approach — it was deprecated April 1, 2025. Use the new native third-party integration described below.

**How it works:**
1. Clerk handles all auth UI, session tokens, and user identity.
2. Supabase is configured to trust Clerk as a third-party auth provider via Clerk's JWKS endpoint — no shared JWT secret needed.
3. The Supabase client is initialized with Clerk's `session.getToken()` as the `accessToken` accessor. This token is automatically refreshed — no manual token fetching per request.
4. RLS policies on every table use `auth.jwt()->>'sub'` to get the Clerk user ID and scope all queries to the requesting user.

**Setup steps for the agent (in order):**

1. In the Clerk dashboard: visit `dashboard.clerk.com/setup/supabase` and connect your Clerk instance to Supabase. This configures the session token to include the `role: "authenticated"` claim Supabase requires.
2. In the Supabase dashboard: go to `Authentication > Third-Party Auth` and add a new Clerk integration. Paste your Clerk domain (e.g. `your-app.clerk.accounts.dev`).
3. Create a `requesting_user_id()` SQL function in Supabase (see Section 4) — this is used as the default for all `user_id` columns and in RLS policies.
4. Initialize the Supabase client using Clerk's session token as the accessor (see Section 5).

---

## 3. New Dependencies

```bash
npm install @clerk/clerk-react @supabase/supabase-js
```

Add to `.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> Never commit `.env`. Add it to `.gitignore` if not already present.

---

## 4. Supabase Schema & SQL

Run all of the following in the Supabase SQL editor in order.

### 4a. Helper function — parse Clerk user ID from JWT

```sql
create or replace function requesting_user_id()
returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$;
```

This function is used as the default value for `user_id` columns and in all RLS policies.

### 4b. Users table (public profile, synced from Clerk)

```sql
create table public.users (
  id          text primary key,            -- Clerk user ID (sub claim)
  username    text unique not null,
  email       text,
  created_at  timestamptz default now()
);

alter table public.users enable row level security;

-- Users can read any profile (needed for leaderboard display names)
create policy "Anyone can read user profiles"
  on public.users for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (requesting_user_id() = id);

-- Users can insert their own profile on first login
create policy "Users can insert own profile"
  on public.users for insert
  to authenticated
  with check (requesting_user_id() = id);
```

### 4c. Progress table (per-topic mastery data)

```sql
create table public.progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default requesting_user_id(),
  topic_id      text not null,             -- e.g. "audio-design", "domain-a"
  attempts      jsonb not null default '[]',  -- array of { questionId, correct, timestamp }
  mastery_level int not null default 0,    -- 0–4
  rolling_score numeric(5,4) default 0,    -- 0.0000 – 1.0000
  xp_earned     int not null default 0,
  updated_at    timestamptz default now(),
  unique (user_id, topic_id)
);

alter table public.progress enable row level security;

create policy "Users can read own progress"
  on public.progress for select
  to authenticated
  using (requesting_user_id() = user_id);

create policy "Users can insert own progress"
  on public.progress for insert
  to authenticated
  with check (requesting_user_id() = user_id);

create policy "Users can update own progress"
  on public.progress for update
  to authenticated
  using (requesting_user_id() = user_id);
```

### 4d. Sessions table (session history)

```sql
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null default requesting_user_id(),
  completed_at     timestamptz default now(),
  score            numeric(5,4) not null,       -- 0.0000 – 1.0000
  question_count   int not null,
  xp_earned        int not null default 0,
  topic_breakdown  jsonb not null default '{}', -- { topicId: { correct, total } }
  mode             text not null default 'practice' -- 'practice' | 'arena' | 'review'
);

alter table public.sessions enable row level security;

create policy "Users can read own sessions"
  on public.sessions for select
  to authenticated
  using (requesting_user_id() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  to authenticated
  with check (requesting_user_id() = user_id);
```

### 4e. Review queue table

```sql
create table public.review_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default requesting_user_id(),
  question_id   text not null,
  added_at      timestamptz default now(),
  attempt_count int not null default 0,
  unique (user_id, question_id)
);

alter table public.review_queue enable row level security;

create policy "Users can manage own review queue"
  on public.review_queue for all
  to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);
```

### 4f. XP and streak table

```sql
create table public.xp (
  user_id          text primary key default requesting_user_id(),
  total            int not null default 0,
  current_streak   int not null default 0,
  longest_streak   int not null default 0,
  last_session_date date,
  updated_at       timestamptz default now()
);

alter table public.xp enable row level security;

create policy "Users can read own XP"
  on public.xp for select
  to authenticated
  using (requesting_user_id() = user_id);

create policy "Users can upsert own XP"
  on public.xp for all
  to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);
```

### 4g. Question comments table

```sql
create table public.question_comments (
  id           uuid primary key default gen_random_uuid(),
  question_id  text not null,               -- matches id field in questions.json
  user_id      text not null default requesting_user_id(),
  body         text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.question_comments enable row level security;

-- Anyone authenticated can read comments on any question
create policy "Authenticated users can read comments"
  on public.question_comments for select
  to authenticated
  using (true);

create policy "Users can insert own comments"
  on public.question_comments for insert
  to authenticated
  with check (requesting_user_id() = user_id);

create policy "Users can update own comments"
  on public.question_comments for update
  to authenticated
  using (requesting_user_id() = user_id);

create policy "Users can delete own comments"
  on public.question_comments for delete
  to authenticated
  using (requesting_user_id() = user_id);
```

### 4h. Question reports table

```sql
create table public.question_reports (
  id           uuid primary key default gen_random_uuid(),
  question_id  text not null,
  user_id      text not null default requesting_user_id(),
  reason       text not null,               -- 'incorrect' | 'ambiguous' | 'outdated' | 'other'
  note         text,                        -- optional freetext from reporter
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  created_at   timestamptz default now()
);

alter table public.question_reports enable row level security;

-- Users can submit and view their own reports
create policy "Users can manage own reports"
  on public.question_reports for all
  to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);
```

> Admin access to all reports is handled via the Supabase service role key in your admin route (see Section 9). Never expose the service role key in client-side code.

### 4i. Leaderboard view (computed, not a table)

```sql
-- A view that computes leaderboard ranking from the xp table + user profiles.
-- No RLS needed on views — it joins only public xp totals.
create or replace view public.leaderboard as
select
  u.id,
  u.username,
  x.total                               as total_xp,
  x.current_streak,
  x.longest_streak,
  row_number() over (order by x.total desc) as rank
from public.xp x
join public.users u on u.id = x.user_id
order by x.total desc
limit 100;
```

---

## 5. Supabase Client Setup

Create `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

// Called once at app startup. Pass in a getToken function from Clerk's useSession hook.
export function createSupabaseClient(getToken) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      accessToken: async () => {
        // Clerk session token — automatically refreshed, no manual polling needed
        return (await getToken()) ?? null
      }
    }
  )
}
```

Create `src/hooks/useSupabase.js`:

```js
import { useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { createSupabaseClient } from '../lib/supabase'

export function useSupabase() {
  const { session } = useSession()
  return useMemo(
    () => createSupabaseClient(() => session?.getToken()),
    [session]
  )
}
```

Use `useSupabase()` in any component that needs to query the database. Never use the service role key in the client.

---

## 6. Clerk Auth Setup

### 6a. Wrap the app

In `src/main.jsx`:

```jsx
import { ClerkProvider } from '@clerk/clerk-react'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={CLERK_KEY}>
    <App />
  </ClerkProvider>
)
```

### 6b. Protect routes

In `src/App.jsx`, wrap all app routes in a `<SignedIn>` guard. Show Clerk's `<SignIn>` component for unauthenticated users:

```jsx
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'

export default function App() {
  return (
    <>
      <SignedIn>
        <AppShell />   {/* existing router + sidebar */}
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-[--bg-base]">
          <SignIn appearance={clerkDarkAppearance} />
        </div>
      </SignedOut>
    </>
  )
}
```

### 6c. Clerk dark theme appearance config

Create `src/lib/clerkTheme.js`:

```js
export const clerkDarkAppearance = {
  variables: {
    colorBackground:     '#161920',
    colorInputBackground:'#1e222d',
    colorText:           '#e8eaf0',
    colorTextSecondary:  '#8b92a8',
    colorPrimary:        '#00d4a8',
    colorDanger:         '#ff6b6b',
    borderRadius:        '0.75rem',
    fontFamily:          'IBM Plex Sans, sans-serif',
  },
  elements: {
    card:        'border border-[#2a2f3d] shadow-none',
    formButton:  'font-mono tracking-wide',
  }
}
```

Pass `appearance={clerkDarkAppearance}` to `<SignIn>`, `<SignUp>`, and `<UserButton>`.

### 6d. User profile sync (first login)

On first login, upsert the user's profile into `public.users`. Do this in a `useEffect` inside `AppShell.jsx` that runs when the Clerk user object loads:

```js
const { user } = useUser()
const supabase = useSupabase()

useEffect(() => {
  if (!user) return
  supabase.from('users').upsert({
    id: user.id,
    username: user.username ?? user.primaryEmailAddress?.emailAddress.split('@')[0],
    email: user.primaryEmailAddress?.emailAddress,
  }, { onConflict: 'id' })
}, [user?.id])
```

### 6e. Add UserButton to sidebar

Replace any hardcoded user display in the sidebar with Clerk's `<UserButton>` component. Place it at the bottom of the sidebar:

```jsx
import { UserButton } from '@clerk/clerk-react'

// Inside Sidebar.jsx, at the bottom:
<UserButton appearance={clerkDarkAppearance} />
```

This gives users access to profile management, email change, and sign-out without you building any of it.

---

## 7. localStorage Migration

On first authenticated load, check for existing Phase 1 localStorage data and migrate it to Supabase. Run once, then set a flag.

Create `src/utils/migrate.js`:

```js
export async function migrateLocalStorageToSupabase(supabase, userId) {
  const flag = localStorage.getItem('patchwork_migrated')
  if (flag === 'true') return

  const progress  = JSON.parse(localStorage.getItem('patchwork_progress')  ?? '{}')
  const sessions  = JSON.parse(localStorage.getItem('patchwork_sessions')  ?? '[]')
  const xp        = JSON.parse(localStorage.getItem('patchwork_xp')        ?? '{}')
  const queue     = JSON.parse(localStorage.getItem('patchwork_review_queue') ?? '[]')

  // Upsert progress rows
  const progressRows = Object.entries(progress).map(([topic_id, data]) => ({
    user_id: userId, topic_id, ...data
  }))
  if (progressRows.length) await supabase.from('progress').upsert(progressRows)

  // Insert session rows
  const sessionRows = sessions.map(s => ({ user_id: userId, ...s }))
  if (sessionRows.length) await supabase.from('sessions').insert(sessionRows)

  // Upsert XP row
  if (Object.keys(xp).length) {
    await supabase.from('xp').upsert({ user_id: userId, ...xp })
  }

  // Insert review queue rows
  const queueRows = queue.map(q => ({ user_id: userId, ...q }))
  if (queueRows.length) await supabase.from('review_queue').upsert(queueRows, { onConflict: 'user_id,question_id' })

  localStorage.setItem('patchwork_migrated', 'true')
}
```

Call this from `AppShell.jsx` after the user profile upsert, passing `user.id`.

---

## 8. Updated Zustand Stores

Modify both stores to read from and write to Supabase instead of localStorage. Remove the `persist` middleware — Supabase is now the persistence layer.

**Pattern for all store actions:**
```js
// Read on mount: fetch from Supabase, hydrate local state
// Write on change: immediately update local state (optimistic), then upsert to Supabase async
```

Optimistic updates keep the UI feeling instant. If the Supabase write fails, log the error but don't revert — data integrity edge cases are acceptable for a personal study tool.

**`progressStore.js`** — on init, fetch all rows from `progress` and `xp` tables for the current user. Replace `localStorage.setItem` calls with `supabase.from('progress').upsert(...)`.

**`sessionStore.js`** — on session complete, insert a row into `sessions`. On init, fetch the last 20 sessions for the mastery trend chart.

---

## 9. New Views

### 9a. Leaderboard (`/leaderboard`)

Add to the sidebar nav between "Review Queue" and the UserButton.

**Layout:** Full-width table, max 100 rows, sorted by total XP descending.

**Columns:**
| # | Username | Total XP | Current Streak | Top Topic | Mastery Badges |
|---|---|---|---|---|---|

**Top Topic** — the sub-topic with the highest `mastery_level` for that user. Requires a join. Use a Supabase RPC (stored procedure) to compute this server-side rather than fetching all progress rows client-side:

```sql
create or replace function get_leaderboard()
returns table (
  rank          bigint,
  user_id       text,
  username      text,
  total_xp      int,
  current_streak int,
  top_topic     text,
  expert_count  bigint
)
language sql stable security definer
as $$
  select
    row_number() over (order by x.total desc) as rank,
    u.id                                       as user_id,
    u.username,
    x.total                                    as total_xp,
    x.current_streak,
    (
      select p.topic_id from public.progress p
      where p.user_id = u.id
      order by p.mastery_level desc, p.rolling_score desc
      limit 1
    )                                          as top_topic,
    (
      select count(*) from public.progress p
      where p.user_id = u.id and p.mastery_level = 4
    )                                          as expert_count
  from public.xp x
  join public.users u on u.id = x.user_id
  order by x.total desc
  limit 100;
$$;
```

Call via: `supabase.rpc('get_leaderboard')`

**Your own row** — highlight the authenticated user's row with `bg-[--bg-elevated] ring-1 ring-[--accent-teal]`. Pin it to the top of the table with a divider if they're outside the top 10.

**Refresh:** Fetch on mount + add a manual "Refresh" button. No real-time subscription needed for a study tool.

**Empty state:** If fewer than 2 users have XP data, show: `"Be the first to top the board — complete a session to appear here."`

### 9b. Admin route (`/admin`)

This route is for you only. Protect it with a hardcoded Clerk user ID check:

```js
const ADMIN_USER_ID = 'user_yourClerkIdHere'
const { user } = useUser()
if (user?.id !== ADMIN_USER_ID) return <Navigate to="/" />
```

The admin route uses the Supabase **service role key** (stored in a separate env var `VITE_SUPABASE_SERVICE_KEY`) to bypass RLS and read all reports. Create a separate client for admin use only:

```js
// src/lib/supabaseAdmin.js — only imported in Admin.jsx
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY  // service role — never use in other files
)
```

**Admin view sections:**

**Open Reports tab:**
- Table of all `question_reports` where `resolved = false`
- Columns: Question ID, Question text (looked up from `questions.json`), Reason, Reporter note, Date, Actions
- Actions: "Resolve" (sets `resolved = true`, `resolved_at = now()`) | "Edit question" (opens inline editor for that question in `questions.json` — note: this edits the local file, so the agent should implement this as a copy-to-clipboard of the question JSON for manual editing)
- Sort by: most reports per question (group by `question_id`, show count badge)

**Comments tab:**
- Table of all `question_comments`, most recent first
- Ability to delete any comment (moderation)

---

## 10. Question Comments & Reports UI

### 10a. Comment thread

After a user submits an answer and the explanation is shown, render a comment section below the explanation card.

**Component:** `src/components/questions/CommentThread.jsx`

```
[Explanation card — existing]

──────────────────────────────
COMMUNITY NOTES   (3 comments)

  ◉  audioguy42 · 2 days ago
     "Don't forget this also applies when the room is non-rectangular —
      the formula breaks down and you need ray tracing software."
     [Reply] [Flag]

  ◉  rileyw · just now
     [your comment]

[Add a note...]  [Post]
──────────────────────────────
```

- Fetch comments for the current `question_id` from Supabase on render
- Display username (from `users` table), body, and relative timestamp (`date-fns` or native `Intl.RelativeTimeFormat`)
- "Flag" link on each comment sends a report for that comment (separate from question reports)
- Input is a plain `<textarea>`, max 500 characters, with character counter
- Post button: disabled if empty or over limit. On success, append optimistically to the list.
- If 0 comments: show `"No notes yet — be the first to add one."` in `--text-muted`

### 10b. Report a question

A flag icon button already exists on each question card (Phase 1). Wire it up to open a small modal:

**Modal fields:**
- Reason (radio): Incorrect answer · Ambiguous wording · Outdated content · Other
- Note (optional textarea, max 300 chars)
- Submit button

On submit: insert into `question_reports`. Show a toast: `"Thanks — we'll review this question."` Disable the flag button for that question for the rest of the session.

---

## 11. Updated File Structure

New and changed files only (everything else from Phase 1 unchanged):

```
src/
├── lib/
│   ├── supabase.js          # createSupabaseClient() factory
│   ├── supabaseAdmin.js     # service role client — admin only
│   └── clerkTheme.js        # Clerk dark appearance config
├── hooks/
│   └── useSupabase.js       # returns a Supabase client scoped to current session
├── utils/
│   └── migrate.js           # one-time localStorage → Supabase migration
├── components/
│   └── questions/
│       ├── CommentThread.jsx # comment list + input
│       └── ReportModal.jsx   # question report modal
├── views/
│   ├── Leaderboard.jsx      # /leaderboard
│   └── Admin.jsx            # /admin — protected by Clerk user ID check
```

---

## 12. Environment Variables

`.env` (never commit):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_SERVICE_KEY=eyJ...    # only used in supabaseAdmin.js
VITE_ADMIN_USER_ID=user_...         # your Clerk user ID for /admin access
```

---

## 13. Definition of Done (Phase 2)

**Auth**
- [ ] Clerk `<SignIn>` shown to unauthenticated users with dark theme applied
- [ ] Signed-in users land on Dashboard automatically
- [ ] `<UserButton>` visible in sidebar, sign-out works
- [ ] Clerk user profile upserted to `public.users` on first login

**Database**
- [ ] All 5 localStorage stores migrated to Supabase tables
- [ ] Migration script runs once on first login and sets the `patchwork_migrated` flag
- [ ] Progress, sessions, XP, and review queue all read from and write to Supabase
- [ ] RLS verified: user A cannot read user B's data (test with two accounts)

**Leaderboard**
- [ ] `/leaderboard` route renders via `get_leaderboard()` RPC
- [ ] Authenticated user's own row highlighted and pinned if outside top 10
- [ ] Empty state shown when fewer than 2 users have data
- [ ] Refresh button works

**Comments**
- [ ] Comment thread renders below explanation after answer submission
- [ ] Post, display, and delete own comments works
- [ ] Relative timestamps display correctly

**Reports**
- [ ] Flag button on question card opens report modal
- [ ] Report inserted to `question_reports` table on submit
- [ ] Flag button disabled for remainder of session after reporting

**Admin**
- [ ] `/admin` returns 404 or redirect for non-admin users
- [ ] Open reports table displays with question text lookup
- [ ] Resolve action works and removes report from open list
- [ ] Comments moderation (delete any comment) works

---

*Brief version: 2.0 | Prepared: May 2026 | Patchwork Phase 2*
