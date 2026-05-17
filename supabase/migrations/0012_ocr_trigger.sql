-- 0012_ocr_trigger.sql
-- Background OCR for diesel purchases and repair quotes captured offline.
-- When a row lands with photos and no prior OCR marker, fire an async pg_net
-- POST to the ocr-extractor edge function. The function fills null columns
-- and writes back the raw extracted text. Idempotent via the
-- zameen.ocr_extractions tracking table.

create extension if not exists pg_net;

create table if not exists zameen.ocr_extractions (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_record_id uuid not null,
  ran_at timestamptz not null default now(),
  confidence numeric(4, 3),
  raw_text text,
  http_request_id bigint,
  unique (source_table, source_record_id)
);

create index if not exists ocr_extractions_record_idx
  on zameen.ocr_extractions (source_table, source_record_id);

-- Diesel purchases: fire when receipt photos present and no prior OCR run.
create or replace function zameen.tg_ocr_diesel()
returns trigger
language plpgsql
as $$
declare
  has_photo boolean;
  already_ran boolean;
  req_id bigint;
begin
  has_photo := jsonb_array_length(coalesce(new.receipt_photo_urls, '[]'::jsonb)) > 0;
  if not has_photo then
    return new;
  end if;
  select exists(
    select 1 from zameen.ocr_extractions
    where source_table = 'diesel_purchases' and source_record_id = new.id
  ) into already_ran;
  if already_ran then
    return new;
  end if;

  req_id := zameen.invoke_edge_function(
    'ocr-extractor',
    jsonb_build_object('table', 'diesel_purchases', 'recordId', new.id)
  );

  insert into zameen.ocr_extractions (source_table, source_record_id, http_request_id)
  values ('diesel_purchases', new.id, req_id)
  on conflict (source_table, source_record_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ocr_diesel_purchases on zameen.diesel_purchases;
create trigger trg_ocr_diesel_purchases
  after insert or update of receipt_photo_urls on zameen.diesel_purchases
  for each row execute function zameen.tg_ocr_diesel();

-- Repair quotes: same pattern keyed off quote_document_urls.
create or replace function zameen.tg_ocr_repair_quote()
returns trigger
language plpgsql
as $$
declare
  has_photo boolean;
  already_ran boolean;
  req_id bigint;
begin
  has_photo := jsonb_array_length(coalesce(new.quote_document_urls, '[]'::jsonb)) > 0;
  if not has_photo then
    return new;
  end if;
  select exists(
    select 1 from zameen.ocr_extractions
    where source_table = 'repair_quotes' and source_record_id = new.id
  ) into already_ran;
  if already_ran then
    return new;
  end if;

  req_id := zameen.invoke_edge_function(
    'ocr-extractor',
    jsonb_build_object('table', 'repair_quotes', 'recordId', new.id)
  );

  insert into zameen.ocr_extractions (source_table, source_record_id, http_request_id)
  values ('repair_quotes', new.id, req_id)
  on conflict (source_table, source_record_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ocr_repair_quotes on zameen.repair_quotes;
create trigger trg_ocr_repair_quotes
  after insert or update of quote_document_urls on zameen.repair_quotes
  for each row execute function zameen.tg_ocr_repair_quote();
