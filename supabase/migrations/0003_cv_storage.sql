-- Private storage bucket for uploaded CVs (build plan §9, "CV upload +
-- parsing to prefill skills"). Files are stored under `${auth.uid()}/...`
-- and RLS restricts every operation to the owning user, matching the
-- profiles/matches pattern already used for the rest of the schema.

alter table public.profiles
  add column if not exists cv_original_name text,
  add column if not exists cv_uploaded_at timestamptz,
  add column if not exists cv_parse_summary text;

insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create policy "Users can upload their own CV"
  on storage.objects for insert
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read their own CV"
  on storage.objects for select
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own CV"
  on storage.objects for update
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own CV"
  on storage.objects for delete
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
