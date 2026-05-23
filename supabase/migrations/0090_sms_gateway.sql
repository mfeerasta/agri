-- 0090_sms_gateway.sql
-- SMS dispatch ledger and translation cache.
--
-- Many Punjab field workers lack WhatsApp but have basic phones. We
-- reach them via SMS through Twilio (primary) or PTCL (fallback). Every
-- send is recorded in sms_deliveries so we can audit cost, retry
-- failures, and reconcile provider invoices.
--
-- translation_cache stores common phrases that pass through the Urdu to
-- Roman Urdu transliterator so we don't re-run the lookup loop on every
-- notification dispatch.

create table if not exists zameen.sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  recipient_phone text not null,
  recipient_user_id uuid,
  body text not null,
  body_language text not null default 'roman_ur'
    check (body_language in ('en','ur','roman_ur','pa','hi')),
  segments int not null default 1,
  cost_pkr numeric(8,4),
  provider text not null,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','failed','undelivered')),
  failure_reason text,
  delivered_at timestamptz,
  sent_at timestamptz,
  notification_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_status
  on zameen.sms_deliveries(status, created_at desc);

create index if not exists idx_sms_recipient_user
  on zameen.sms_deliveries(recipient_user_id, created_at desc);

create index if not exists idx_sms_notification
  on zameen.sms_deliveries(notification_id);

alter table zameen.sms_deliveries enable row level security;

drop policy if exists "sms_deliveries_entity_read" on zameen.sms_deliveries;
create policy "sms_deliveries_entity_read" on zameen.sms_deliveries
  for select using (
    entity_id in (
      select entity_id from zameen.user_entity_roles where user_id = auth.uid()
    )
  );

create table if not exists zameen.translation_cache (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  source_lang text not null,
  target_lang text not null,
  translated_text text not null,
  translation_engine text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_tcache_src
  on zameen.translation_cache(source_text, source_lang, target_lang);

alter table zameen.translation_cache enable row level security;

drop policy if exists "tcache_read_all" on zameen.translation_cache;
create policy "tcache_read_all" on zameen.translation_cache
  for select using (auth.uid() is not null);
