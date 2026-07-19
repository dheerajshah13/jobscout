-- AI Match Runs: each row is one user-triggered "Run AI matching" pass.
-- Used for the dashboard's last-run stats and for free-tier rate limiting
-- (runs per day are counted against this table).

create table public.match_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ran_at timestamptz not null default now(),
  segments jsonb not null default '[]'::jsonb,
  jobs_scanned integer not null default 0,
  jobs_matched integer not null default 0,
  source_errors jsonb not null default '[]'::jsonb
);

create index match_runs_user_ran_idx on public.match_runs (user_id, ran_at desc);

alter table public.match_runs enable row level security;

create policy "Users can read own runs" on public.match_runs
  for select using (auth.uid() = user_id);

create policy "Users can insert own runs" on public.match_runs
  for insert with check (auth.uid() = user_id);
