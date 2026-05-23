-- Procurement RFQ (request-for-quote) workflow.
-- Mirrors the multi-quote pattern from zameen.repair_quotes but for
-- general procurement: invite multiple vendors, collect quotes, pick a
-- winner through the approval engine, auto-create a purchase order.

create table if not exists zameen.rfqs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  rfq_number text not null,
  title text not null,
  description text,
  category text not null,
  needed_by date,
  field_id uuid references zameen.fields(id),
  crop_plan_id uuid,
  budget_estimate_pkr numeric(14,2),
  status text not null default 'draft' check (status in ('draft','sent','quotes_received','selected','closed','cancelled')),
  selected_quote_id uuid,
  selection_reason text,
  approval_request_id uuid,
  purchase_order_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_rfq_entity_num on zameen.rfqs(entity_id, rfq_number);
create index if not exists idx_rfq_status on zameen.rfqs(entity_id, status);
create index if not exists idx_rfq_category on zameen.rfqs(entity_id, category);

create table if not exists zameen.rfq_line_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references zameen.rfqs(id) on delete cascade,
  description text not null,
  quantity numeric(14,4) not null,
  unit text not null,
  specifications jsonb,
  order_index int not null default 0
);
create index if not exists idx_rfqli_rfq on zameen.rfq_line_items(rfq_id);

create table if not exists zameen.rfq_invitations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references zameen.rfqs(id) on delete cascade,
  vendor_id uuid not null references zameen.vendors(id),
  sent_at timestamptz,
  responded_at timestamptz,
  declined_reason text,
  reply_token text unique
);
create index if not exists idx_rfqi_rfq on zameen.rfq_invitations(rfq_id);
create unique index if not exists idx_rfqi_rfq_vendor on zameen.rfq_invitations(rfq_id, vendor_id);

create table if not exists zameen.rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references zameen.rfqs(id) on delete cascade,
  vendor_id uuid not null references zameen.vendors(id),
  quoted_on timestamptz not null default now(),
  total_pkr numeric(14,2) not null,
  payment_terms text,
  delivery_lead_days int,
  validity_days int,
  notes text,
  quote_doc_url text,
  line_prices jsonb not null default '[]'::jsonb,
  is_winner boolean not null default false
);
create index if not exists idx_rfqq_rfq on zameen.rfq_quotes(rfq_id);
create index if not exists idx_rfqq_vendor on zameen.rfq_quotes(vendor_id);

alter table zameen.rfqs enable row level security;
alter table zameen.rfq_line_items enable row level security;
alter table zameen.rfq_invitations enable row level security;
alter table zameen.rfq_quotes enable row level security;

create policy rfq_entity on zameen.rfqs
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy rfqli_via_rfq on zameen.rfq_line_items
  for all using (exists (
    select 1 from zameen.rfqs r
    where r.id = rfq_id and r.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
create policy rfqi_via_rfq on zameen.rfq_invitations
  for all using (exists (
    select 1 from zameen.rfqs r
    where r.id = rfq_id and r.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
create policy rfqq_via_rfq on zameen.rfq_quotes
  for all using (exists (
    select 1 from zameen.rfqs r
    where r.id = rfq_id and r.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));

-- Extend approval_type enum to include vendor_selection.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'approval_type' and e.enumlabel = 'vendor_selection'
  ) then
    alter type zameen.approval_type add value 'vendor_selection';
  end if;
end$$;
