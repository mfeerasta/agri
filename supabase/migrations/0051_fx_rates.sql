-- Daily FX rates against PKR. Populated by the fx-poller edge function from
-- exchangerate.host. Visible to all authenticated users (rates are public data).

create table if not exists zameen.fx_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  base_currency text not null,
  quote_currency text not null,
  rate numeric(14,6) not null,
  source text not null default 'exchangerate.host',
  fetched_at timestamptz not null default now(),
  unique (date, base_currency, quote_currency, source)
);

create index if not exists idx_fx_date on zameen.fx_rates(date desc);
create index if not exists idx_fx_pair on zameen.fx_rates(base_currency, quote_currency, date desc);

alter table zameen.fx_rates enable row level security;

create policy "fx_authenticated" on zameen.fx_rates
  for select
  using (auth.role() = 'authenticated');
