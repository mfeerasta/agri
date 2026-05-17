-- Full-text search across receipts, invoices, and supporting documents.
-- The 'simple' dictionary is used since Postgres core lacks Urdu/Punjabi/Hindi stemmers;
-- OCR text in metadata provides searchable surface for non-English receipts.

-- documents
alter table zameen.documents add column if not exists fts_vector tsvector;

create or replace function zameen.documents_fts_update() returns trigger language plpgsql as $$
begin
  new.fts_vector := to_tsvector('simple',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.document_type::text, '') || ' ' ||
    coalesce((new.metadata->>'ocrText')::text, '') || ' ' ||
    coalesce((new.metadata->>'vendor')::text, '') || ' ' ||
    coalesce((new.metadata->>'amount')::text, '')
  );
  return new;
end$$;

drop trigger if exists documents_fts on zameen.documents;
create trigger documents_fts before insert or update on zameen.documents
  for each row execute function zameen.documents_fts_update();

create index if not exists idx_documents_fts on zameen.documents using gin(fts_vector);

-- backfill: touch each row to fire the trigger
update zameen.documents set title = title where fts_vector is null;

-- diesel_purchases
alter table zameen.diesel_purchases add column if not exists fts_vector tsvector;

create or replace function zameen.diesel_purchases_fts_update() returns trigger language plpgsql as $$
begin
  new.fts_vector := to_tsvector('simple',
    coalesce(new.vendor_name, '') || ' ' ||
    coalesce(new.vendor_location, '') || ' ' ||
    coalesce(new.notes, '') || ' ' ||
    coalesce(new.total_pkr::text, '')
  );
  return new;
end$$;

drop trigger if exists diesel_purchases_fts on zameen.diesel_purchases;
create trigger diesel_purchases_fts before insert or update on zameen.diesel_purchases
  for each row execute function zameen.diesel_purchases_fts_update();

create index if not exists idx_diesel_purchases_fts on zameen.diesel_purchases using gin(fts_vector);
update zameen.diesel_purchases set vendor_name = vendor_name where fts_vector is null;

-- input_purchases
alter table zameen.input_purchases add column if not exists fts_vector tsvector;

create or replace function zameen.input_purchases_fts_update() returns trigger language plpgsql as $$
declare
  v_vendor text;
begin
  select coalesce(name, '') into v_vendor from zameen.vendors where id = new.vendor_id;
  new.fts_vector := to_tsvector('simple',
    coalesce(v_vendor, '') || ' ' ||
    coalesce(new.invoice_number, '') || ' ' ||
    coalesce(new.batch_number, '') || ' ' ||
    coalesce(new.notes, '') || ' ' ||
    coalesce(new.total_pkr::text, '')
  );
  return new;
end$$;

drop trigger if exists input_purchases_fts on zameen.input_purchases;
create trigger input_purchases_fts before insert or update on zameen.input_purchases
  for each row execute function zameen.input_purchases_fts_update();

create index if not exists idx_input_purchases_fts on zameen.input_purchases using gin(fts_vector);
update zameen.input_purchases set invoice_number = invoice_number where fts_vector is null;

-- repair_quotes
alter table zameen.repair_quotes add column if not exists fts_vector tsvector;

create or replace function zameen.repair_quotes_fts_update() returns trigger language plpgsql as $$
begin
  new.fts_vector := to_tsvector('simple',
    coalesce(new.workshop_name, '') || ' ' ||
    coalesce(new.workshop_location, '') || ' ' ||
    coalesce(new.ocr_extracted_text, '') || ' ' ||
    coalesce(new.parts_list::text, '') || ' ' ||
    coalesce(new.total_quote_pkr::text, '')
  );
  return new;
end$$;

drop trigger if exists repair_quotes_fts on zameen.repair_quotes;
create trigger repair_quotes_fts before insert or update on zameen.repair_quotes
  for each row execute function zameen.repair_quotes_fts_update();

create index if not exists idx_repair_quotes_fts on zameen.repair_quotes using gin(fts_vector);
update zameen.repair_quotes set workshop_name = workshop_name where fts_vector is null;
