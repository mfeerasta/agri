'use server';

import { sql } from 'drizzle-orm';
import { db } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export type ReceiptKind = 'document' | 'diesel' | 'input' | 'repair';

export interface ReceiptResult {
  id: string;
  kind: ReceiptKind;
  title: string;
  vendor: string | null;
  dateIso: string | null;
  amountPkr: number | null;
  thumbnailUrl: string | null;
  sourceLink: string;
}

export interface SearchReceiptsInput {
  query?: string;
  kinds?: ReceiptKind[];
  vendorMatch?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  limit?: number;
  offset?: number;
}

function toTsQuery(q: string): string {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .map((t) => `${t}:*`);
  return tokens.join(' & ');
}

export async function searchReceipts(input: SearchReceiptsInput): Promise<{ rows: ReceiptResult[]; total: number }> {
  const session = await getSessionContext();
  if (!session) return { rows: [], total: 0 };

  const limit = Math.min(input.limit ?? 50, 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const tsQuery = input.query ? toTsQuery(input.query) : '';
  const hasTs = tsQuery.length > 0;

  const kinds = input.kinds && input.kinds.length > 0 ? new Set(input.kinds) : null;
  const wantAll = !kinds;
  const wantDoc = wantAll || (kinds?.has('document') ?? false);
  const wantDiesel = wantAll || (kinds?.has('diesel') ?? false);
  const wantInput = wantAll || (kinds?.has('input') ?? false);
  const wantRepair = wantAll || (kinds?.has('repair') ?? false);

  const dateFrom = input.dateFrom ?? '1970-01-01';
  const dateTo = input.dateTo ?? '2999-12-31';
  const amountMin = input.amountMin ?? 0;
  const amountMax = input.amountMax ?? Number.MAX_SAFE_INTEGER;
  const vendorLike = input.vendorMatch ? `%${input.vendorMatch.toLowerCase()}%` : null;
  const entityId = session.entityId;

  const subqueries: ReturnType<typeof sql>[] = [];

  if (wantDoc) {
    subqueries.push(sql`
      select
        d.id::text as id,
        'document'::text as kind,
        d.title as title,
        (d.metadata->>'vendor') as vendor,
        coalesce(d.issued_on::text, d.uploaded_at::date::text) as date_iso,
        nullif((d.metadata->>'amount'), '')::numeric as amount_pkr,
        d.file_url as thumbnail_url,
        ('/compliance/documents/' || d.id::text) as source_link,
        coalesce(d.uploaded_at, now()) as sort_at
      from zameen.documents d
      where d.entity_id = ${entityId}::uuid
        ${hasTs ? sql`and d.fts_vector @@ to_tsquery('simple', ${tsQuery})` : sql``}
        and coalesce(d.issued_on, d.uploaded_at::date) between ${dateFrom}::date and ${dateTo}::date
        ${vendorLike ? sql`and lower(coalesce((d.metadata->>'vendor'), '')) like ${vendorLike}` : sql``}
    `);
  }
  if (wantDiesel) {
    subqueries.push(sql`
      select
        dp.id::text,
        'diesel'::text,
        ('Diesel from ' || coalesce(dp.vendor_name, 'unknown')),
        dp.vendor_name,
        dp.purchased_at::date::text,
        dp.total_pkr::numeric,
        (dp.receipt_photo_urls->>0),
        ('/diesel/purchases/' || dp.id::text),
        dp.purchased_at
      from zameen.diesel_purchases dp
      where dp.entity_id = ${entityId}::uuid
        ${hasTs ? sql`and dp.fts_vector @@ to_tsquery('simple', ${tsQuery})` : sql``}
        and dp.purchased_at::date between ${dateFrom}::date and ${dateTo}::date
        and dp.total_pkr between ${amountMin} and ${amountMax}
        ${vendorLike ? sql`and lower(coalesce(dp.vendor_name, '')) like ${vendorLike}` : sql``}
    `);
  }
  if (wantInput) {
    subqueries.push(sql`
      select
        ip.id::text,
        'input'::text,
        ('Input purchase ' || coalesce(ip.invoice_number, ip.id::text)),
        (select v.name from zameen.vendors v where v.id = ip.vendor_id),
        ip.purchased_on::date::text,
        ip.total_pkr::numeric,
        (ip.receipt_photo_urls->>0),
        ('/inventory/purchases/' || ip.id::text),
        ip.purchased_on
      from zameen.input_purchases ip
      where ip.entity_id = ${entityId}::uuid
        ${hasTs ? sql`and ip.fts_vector @@ to_tsquery('simple', ${tsQuery})` : sql``}
        and ip.purchased_on::date between ${dateFrom}::date and ${dateTo}::date
        and ip.total_pkr between ${amountMin} and ${amountMax}
        ${vendorLike ? sql`and exists (select 1 from zameen.vendors v where v.id = ip.vendor_id and lower(v.name) like ${vendorLike})` : sql``}
    `);
  }
  if (wantRepair) {
    subqueries.push(sql`
      select
        rq.id::text,
        'repair'::text,
        ('Repair quote ' || rq.workshop_name),
        rq.workshop_name,
        rq.submitted_at::date::text,
        rq.total_quote_pkr::numeric,
        (rq.quote_document_urls->>0),
        ('/repairs/quotes/' || rq.id::text),
        rq.submitted_at
      from zameen.repair_quotes rq
      join zameen.repair_requests rr on rr.id = rq.repair_request_id
      where rr.entity_id = ${entityId}::uuid
        ${hasTs ? sql`and rq.fts_vector @@ to_tsquery('simple', ${tsQuery})` : sql``}
        and rq.submitted_at::date between ${dateFrom}::date and ${dateTo}::date
        and rq.total_quote_pkr between ${amountMin} and ${amountMax}
        ${vendorLike ? sql`and lower(coalesce(rq.workshop_name, '')) like ${vendorLike}` : sql``}
    `);
  }

  if (subqueries.length === 0) return { rows: [], total: 0 };

  const union = subqueries.reduce((acc, q, i) => (i === 0 ? q : sql`${acc} union all ${q}`));

  const result = await db.execute(sql`
    with combined as (${union})
    select
      id, kind, title, vendor, date_iso, amount_pkr, thumbnail_url, source_link,
      (select count(*) from combined) as total
    from combined
    order by sort_at desc nulls last
    limit ${limit} offset ${offset}
  `);

  const rawRows =
    (result as unknown as {
      rows?: Array<{
        id: string;
        kind: ReceiptKind;
        title: string;
        vendor: string | null;
        date_iso: string | null;
        amount_pkr: string | null;
        thumbnail_url: string | null;
        source_link: string;
        total: string;
      }>;
    }).rows ?? [];

  const total = rawRows[0] ? Number(rawRows[0].total) : 0;

  const rows: ReceiptResult[] = rawRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    vendor: r.vendor,
    dateIso: r.date_iso,
    amountPkr: r.amount_pkr ? Number(r.amount_pkr) : null,
    thumbnailUrl: r.thumbnail_url,
    sourceLink: r.source_link,
  }));

  return { rows, total };
}
