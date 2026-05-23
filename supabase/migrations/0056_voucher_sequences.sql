-- Voucher sequences. Atomic monthly counters used by the finance package
-- wrapper at packages/finance/src/voucher-numbering.ts. The existing
-- migration 0044 already provides the fiscal-year `voucher_counters` table
-- and the SQL function `zameen.next_voucher_number(entity, kind)` which
-- returns prefixed identifiers like CRV-26-27-00001.
--
-- This migration adds a second numbering surface (per-month YYYYMM) for
-- callers that prefer the CR-YYYYMM-NNNN / CP- / JV- / PS- / MP- / GRN-
-- scheme described in the spec, and exposes a compatibility view named
-- `voucher_sequences` so older consumers can read the counter state.

create table if not exists zameen.voucher_sequences (
  scheme text not null,
  yyyymm text not null,
  last_number integer not null default 0,
  primary key (scheme, yyyymm)
);

alter table zameen.voucher_sequences enable row level security;

drop policy if exists "voucher_sequences_select_all" on zameen.voucher_sequences;
create policy "voucher_sequences_select_all"
  on zameen.voucher_sequences
  for select
  using (true);

drop policy if exists "voucher_sequences_insert_block" on zameen.voucher_sequences;
create policy "voucher_sequences_insert_block"
  on zameen.voucher_sequences
  for insert
  with check (false);

drop policy if exists "voucher_sequences_update_block" on zameen.voucher_sequences;
create policy "voucher_sequences_update_block"
  on zameen.voucher_sequences
  for update
  using (false);

-- Atomic increment. Returns the formatted voucher number for the given
-- scheme (e.g. 'CR', 'CP', 'JV', 'PS', 'MP', 'GRN') and the current month.
create or replace function zameen.next_voucher_number_monthly(p_scheme text)
returns text
language plpgsql
as $$
declare
  ym text;
  next_n integer;
begin
  ym := to_char(current_date, 'YYYYMM');
  insert into zameen.voucher_sequences(scheme, yyyymm, last_number)
  values (upper(p_scheme), ym, 1)
  on conflict (scheme, yyyymm)
  do update set last_number = zameen.voucher_sequences.last_number + 1
  returning last_number into next_n;
  return upper(p_scheme) || '-' || ym || '-' || lpad(next_n::text, 4, '0');
end;
$$;
