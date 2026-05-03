-- Patchwork Phase 2 schema
-- Run this in your Supabase SQL editor (https://supabase.com/dashboard/project/_/sql)
-- in order, top to bottom. Idempotent: safe to re-run.

-- 1. Helper function: parse Clerk user ID from JWT
create or replace function requesting_user_id()
returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$;

-- 2. Users (synced from Clerk)
create table if not exists public.patch_users (
  id          text primary key,
  username    text unique not null,
  email       text,
  created_at  timestamptz default now()
);
alter table public.patch_users enable row level security;
drop policy if exists "Anyone can read user profiles" on public.patch_users;
create policy "Anyone can read user profiles" on public.patch_users
  for select to authenticated using (true);
drop policy if exists "Users can update own profile" on public.patch_users;
create policy "Users can update own profile" on public.patch_users
  for update to authenticated using (requesting_user_id() = id);
drop policy if exists "Users can insert own profile" on public.patch_users;
create policy "Users can insert own profile" on public.patch_users
  for insert to authenticated with check (requesting_user_id() = id);

-- 3. Progress (one row per user × topic)
create table if not exists public.patch_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default requesting_user_id(),
  topic_id      text not null,
  attempts      jsonb not null default '[]',
  mastery_level int not null default 0,
  rolling_score numeric(5,4) default 0,
  xp_earned     int not null default 0,
  updated_at    timestamptz default now(),
  unique (user_id, topic_id)
);
alter table public.patch_progress enable row level security;
drop policy if exists "Users manage own progress" on public.patch_progress;
create policy "Users manage own progress" on public.patch_progress
  for all to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);

-- 4. Sessions
create table if not exists public.patch_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null default requesting_user_id(),
  completed_at     timestamptz default now(),
  score            numeric(5,4) not null,
  question_count   int not null,
  xp_earned        int not null default 0,
  topic_breakdown  jsonb not null default '{}',
  mode             text not null default 'practice'
);
alter table public.patch_sessions enable row level security;
drop policy if exists "Users manage own sessions" on public.patch_sessions;
create policy "Users manage own sessions" on public.patch_sessions
  for all to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);

-- 5. Review queue
create table if not exists public.patch_review_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default requesting_user_id(),
  question_id   text not null,
  added_at      timestamptz default now(),
  attempt_count int not null default 0,
  unique (user_id, question_id)
);
alter table public.patch_review_queue enable row level security;
drop policy if exists "Users manage own review queue" on public.patch_review_queue;
create policy "Users manage own review queue" on public.patch_review_queue
  for all to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);

-- 6. XP / streaks
create table if not exists public.patch_xp (
  user_id            text primary key default requesting_user_id(),
  total              int not null default 0,
  current_streak     int not null default 0,
  longest_streak     int not null default 0,
  last_session_date  date,
  updated_at         timestamptz default now()
);
alter table public.patch_xp enable row level security;
drop policy if exists "Users manage own xp" on public.patch_xp;
create policy "Users manage own xp" on public.patch_xp
  for all to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);

-- 7. Question comments
create table if not exists public.patch_question_comments (
  id           uuid primary key default gen_random_uuid(),
  question_id  text not null,
  user_id      text not null default requesting_user_id(),
  body         text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.patch_question_comments enable row level security;
drop policy if exists "Authenticated can read comments" on public.patch_question_comments;
create policy "Authenticated can read comments" on public.patch_question_comments
  for select to authenticated using (true);
drop policy if exists "Users insert own comments" on public.patch_question_comments;
create policy "Users insert own comments" on public.patch_question_comments
  for insert to authenticated with check (requesting_user_id() = user_id);
drop policy if exists "Users update own comments" on public.patch_question_comments;
create policy "Users update own comments" on public.patch_question_comments
  for update to authenticated using (requesting_user_id() = user_id);
drop policy if exists "Users delete own comments" on public.patch_question_comments;
create policy "Users delete own comments" on public.patch_question_comments
  for delete to authenticated using (requesting_user_id() = user_id);

-- 8. Question reports
create table if not exists public.patch_question_reports (
  id           uuid primary key default gen_random_uuid(),
  question_id  text not null,
  user_id      text not null default requesting_user_id(),
  reason       text not null,
  note         text,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  created_at   timestamptz default now()
);
alter table public.patch_question_reports enable row level security;
drop policy if exists "Users manage own reports" on public.patch_question_reports;
create policy "Users manage own reports" on public.patch_question_reports
  for all to authenticated
  using (requesting_user_id() = user_id)
  with check (requesting_user_id() = user_id);

-- 9. Leaderboard RPC
create or replace function get_leaderboard()
returns table (
  rank           bigint,
  user_id        text,
  username       text,
  total_xp       int,
  current_streak int,
  top_topic      text,
  expert_count   bigint
)
language sql stable security definer
as $$
  select
    row_number() over (order by x.total desc) as rank,
    u.id as user_id,
    u.username,
    x.total as total_xp,
    x.current_streak,
    (
      select p.topic_id from public.patch_progress p
      where p.user_id = u.id
      order by p.mastery_level desc, p.rolling_score desc
      limit 1
    ) as top_topic,
    (
      select count(*) from public.patch_progress p
      where p.user_id = u.id and p.mastery_level = 4
    ) as expert_count
  from public.patch_xp x
  join public.patch_users u on u.id = x.user_id
  order by x.total desc
  limit 100;
$$;

grant execute on function get_leaderboard() to authenticated;
