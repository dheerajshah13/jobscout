create extension if not exists pg_trgm;
create extension if not exists vector;

create type remote_mode as enum ('none', 'hybrid', 'full');
create type job_status as enum ('active', 'stale', 'expired');
create type match_status as enum ('new', 'seen', 'saved', 'applied', 'hidden');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text not null,
  company text not null,
  location text not null,
  remote remote_mode not null default 'none',
  salary_min integer,
  salary_max integer,
  currency text not null default 'EUR',
  description text not null default '',
  apply_url text not null,
  posted_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status job_status not null default 'active',
  embedding vector(1536)
);

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  source_name text not null,
  source_job_id text not null,
  source_url text not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (source_name, source_job_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skills text[] not null default '{}',
  target_titles text[] not null default '{}',
  locations text[] not null default '{}',
  remote_pref text not null default 'none',
  salary_floor integer,
  seniority text,
  cv_storage_path text,
  alert_threshold integer not null default 75,
  email_frequency text not null default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  score_breakdown jsonb not null,
  reason text,
  status match_status not null default 'new',
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table public.search_segments (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  location text not null,
  active_user_count integer not null default 0,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (keyword, location)
);

create index jobs_title_trgm_idx on public.jobs using gin (title gin_trgm_ops);
create index jobs_company_trgm_idx on public.jobs using gin (company gin_trgm_ops);
create index jobs_status_posted_idx on public.jobs (status, posted_at desc);
create index matches_user_score_idx on public.matches (user_id, score desc);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = user_id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can read own matches" on public.matches
  for select using (auth.uid() = user_id);

create policy "Users can update own match status" on public.matches
  for update using (auth.uid() = user_id);

create policy "Public active jobs are readable" on public.jobs
  for select using (status = 'active');

create policy "Public job sources are readable" on public.job_sources
  for select using (
    exists (
      select 1 from public.jobs
      where public.jobs.id = public.job_sources.job_id
      and public.jobs.status = 'active'
    )
  );
