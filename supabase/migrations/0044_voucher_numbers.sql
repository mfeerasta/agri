-- Voucher numbering. Stored procedure issues fiscal-year-prefixed numbers
-- like CRV-26-27-00001. Atomic via UPSERT on (entity, kind, fiscal_year).

create table if not exists zameen.voucher_counters (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  voucher_kind text not null,
  fiscal_year text not null,
  last_number int not null default 0,
  unique (entity_id, voucher_kind, fiscal_year)
);

-- Pakistani fiscal year runs July to June. Use the current date to derive
-- a 'YY-YY' label. Year boundary: July 1.
create or replace function zameen.fiscal_year_label(p_date date)
returns text
language plpgsql
immutable
as $$
declare
  start_year int;
begin
  if extract(month from p_date) >= 7 then
    start_year := extract(year from p_date)::int;
  else
    start_year := extract(year from p_date)::int - 1;
  end if;
  return lpad((start_year % 100)::text, 2, '0')
    || '-'
    || lpad(((start_year + 1) % 100)::text, 2, '0');
end;
$$;

create or replace function zameen.next_voucher_number(p_entity uuid, p_kind text)
returns text
language plpgsql
as $$
declare
  fy text;
  next_n int;
  prefix text;
begin
  fy := zameen.fiscal_year_label(current_date);

  insert into zameen.voucher_counters(entity_id, voucher_kind, fiscal_year, last_number)
  values (p_entity, p_kind, fy, 1)
  on conflict (entity_id, voucher_kind, fiscal_year)
  do update set last_number = zameen.voucher_counters.last_number + 1
  returning last_number into next_n;

  prefix := case lower(p_kind)
    when 'cash-receipt' then 'CRV'
    when 'cash-payment' then 'CPV'
    when 'bank-receipt' then 'BRV'
    when 'bank-payment' then 'BPV'
    when 'journal' then 'JV'
    when 'payslip' then 'PSL'
    when 'mandi-patti' then 'MP'
    when 'grn' then 'GRN'
    when 'purchase-invoice' then 'PIV'
    when 'diesel-purchase' then 'DPV'
    else upper(p_kind)
  end;

  return prefix || '-' || fy || '-' || lpad(next_n::text, 5, '0');
end;
$$;

-- Voucher number column on journal_entries (immutable once issued).
alter table zameen.journal_entries
  add column if not exists voucher_number text;

create unique index if not exists journal_entries_voucher_number_uidx
  on zameen.journal_entries (voucher_number)
  where voucher_number is not null;

-- Trigger fills voucher_number at insert based on the journal's cash/bank legs.
create or replace function zameen.fill_journal_voucher_number()
returns trigger
language plpgsql
as $$
declare
  has_cash_dr boolean;
  has_cash_cr boolean;
  has_bank_dr boolean;
  has_bank_cr boolean;
  kind text;
begin
  if new.voucher_number is not null then
    return new;
  end if;

  select
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1000' and jl.debit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1000' and jl.credit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1010' and jl.debit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1010' and jl.credit_pkr > 0
    )
  into has_cash_dr, has_cash_cr, has_bank_dr, has_bank_cr;

  kind := case
    when has_cash_dr then 'cash-receipt'
    when has_cash_cr then 'cash-payment'
    when has_bank_dr then 'bank-receipt'
    when has_bank_cr then 'bank-payment'
    else 'journal'
  end;

  new.voucher_number := zameen.next_voucher_number(new.entity_id, kind);
  return new;
end;
$$;

-- Use AFTER INSERT to ensure journal_lines exist. Update voucher_number on the row.
create or replace function zameen.assign_journal_voucher_number_after()
returns trigger
language plpgsql
as $$
declare
  has_cash_dr boolean;
  has_cash_cr boolean;
  has_bank_dr boolean;
  has_bank_cr boolean;
  kind text;
  vn text;
begin
  if new.voucher_number is not null then
    return new;
  end if;

  select
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1000' and jl.debit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1000' and jl.credit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1010' and jl.debit_pkr > 0
    ),
    exists (
      select 1 from zameen.journal_lines jl
      join zameen.accounts a on a.id = jl.account_id
      where jl.journal_entry_id = new.id and a.code = '1010' and jl.credit_pkr > 0
    )
  into has_cash_dr, has_cash_cr, has_bank_dr, has_bank_cr;

  kind := case
    when has_cash_dr then 'cash-receipt'
    when has_cash_cr then 'cash-payment'
    when has_bank_dr then 'bank-receipt'
    when has_bank_cr then 'bank-payment'
    else 'journal'
  end;

  vn := zameen.next_voucher_number(new.entity_id, kind);
  update zameen.journal_entries set voucher_number = vn where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_assign_journal_voucher_number on zameen.journal_entries;
create trigger trg_assign_journal_voucher_number
  after insert on zameen.journal_entries
  for each row
  execute function zameen.assign_journal_voucher_number_after();

-- Prevent updates of voucher_number after it is set.
create or replace function zameen.prevent_voucher_number_update()
returns trigger
language plpgsql
as $$
begin
  if old.voucher_number is not null and new.voucher_number is distinct from old.voucher_number then
    raise exception 'voucher_number is immutable once issued';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_voucher_number on zameen.journal_entries;
create trigger trg_protect_voucher_number
  before update on zameen.journal_entries
  for each row
  execute function zameen.prevent_voucher_number_update();

alter table zameen.voucher_counters enable row level security;

create policy "voucher_counters_select_same_entity"
  on zameen.voucher_counters
  for select
  using (true);

create policy "voucher_counters_insert_block"
  on zameen.voucher_counters
  for insert
  with check (false);

create policy "voucher_counters_update_block"
  on zameen.voucher_counters
  for update
  using (false);
