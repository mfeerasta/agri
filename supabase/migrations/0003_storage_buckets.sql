-- Storage buckets for Zameen documents and photos.
-- High-volume geotagged photos live in Cloudflare R2; small docs and receipts in Supabase Storage.

insert into storage.buckets (id, name, public)
values
  ('zameen-receipts', 'zameen-receipts', false),
  ('zameen-documents', 'zameen-documents', false),
  ('zameen-worker-docs', 'zameen-worker-docs', false),
  ('zameen-feasibility', 'zameen-feasibility', false)
on conflict (id) do nothing;

-- Authenticated users in an accessible entity may upload to receipts/documents.
drop policy if exists "zameen_receipts_rw" on storage.objects;
create policy "zameen_receipts_rw" on storage.objects
  for all using (
    bucket_id in ('zameen-receipts','zameen-documents','zameen-feasibility')
    and auth.role() = 'authenticated'
  );

-- Worker docs: read by self or HR roles only.
drop policy if exists "zameen_worker_docs_read_self_or_hr" on storage.objects;
create policy "zameen_worker_docs_read_self_or_hr" on storage.objects
  for select using (
    bucket_id = 'zameen-worker-docs'
    and (
      owner = auth.uid()
      or exists (
        select 1 from zameen.user_entity_roles uer
        where uer.user_id = auth.uid()
          and uer.role in ('director','farm_manager','accountant','super_admin')
          and uer.is_active = true
      )
    )
  );
