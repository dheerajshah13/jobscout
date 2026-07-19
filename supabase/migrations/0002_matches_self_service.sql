-- Allow signed-in users to create their own match rows (needed so save/hide
-- works even before a background ingestion run has scored a job for them),
-- and allow self-service deletion of profile/match rows for GDPR data
-- deletion requests that don't go through the admin API.

create policy "Users can insert own matches" on public.matches
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own matches" on public.matches
  for delete using (auth.uid() = user_id);

create policy "Users can delete own profile" on public.profiles
  for delete using (auth.uid() = user_id);
