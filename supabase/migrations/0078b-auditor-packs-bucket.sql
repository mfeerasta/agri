-- 0078b-auditor-packs-bucket.sql
-- Storage bucket for finished auditor export ZIPs. Private; access only via
-- short-lived signed URLs minted by the app or build-auditor-pack edge fn.

insert into storage.buckets (id, name, public)
values ('auditor-packs', 'auditor-packs', false)
on conflict (id) do nothing;

drop policy if exists auditor_packs_select on storage.objects;
create policy auditor_packs_select on storage.objects
  for select using (
    bucket_id = 'auditor-packs'
    and auth.uid() is not null
  );

drop policy if exists auditor_packs_no_direct_write on storage.objects;
create policy auditor_packs_no_direct_write on storage.objects
  for insert with check (
    bucket_id <> 'auditor-packs' or auth.role() = 'service_role'
  );
