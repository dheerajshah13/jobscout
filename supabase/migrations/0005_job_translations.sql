-- Cached machine translations of job postings (EN/DE toggle). One row per
-- job per target language; written by the server with the service role,
-- readable by everyone since job content itself is public.

create table public.job_translations (
  job_id uuid not null references public.jobs(id) on delete cascade,
  lang text not null,
  title text not null,
  description text not null,
  translated_at timestamptz not null default now(),
  primary key (job_id, lang)
);

alter table public.job_translations enable row level security;

create policy "Translations are readable" on public.job_translations
  for select using (true);
