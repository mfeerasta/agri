import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { searchReceipts, type ReceiptKind } from '@/modules/receipts/actions';
import { ReceiptsClient } from './receipts-client';

export const dynamic = 'force-dynamic';

const VALID_KINDS: ReadonlySet<ReceiptKind> = new Set(['document', 'diesel', 'input', 'repair']);

function parseKinds(raw: string | string[] | undefined): ReceiptKind[] | undefined {
  if (!raw) return undefined;
  const arr = Array.isArray(raw) ? raw : raw.split(',');
  const filtered = arr.filter((k): k is ReceiptKind => VALID_KINDS.has(k as ReceiptKind));
  return filtered.length > 0 ? filtered : undefined;
}

function numOrUndef(v: string | string[] | undefined): number | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function strOrUndef(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = strOrUndef(params.q);
  const kinds = parseKinds(params.kinds);
  const vendor = strOrUndef(params.vendor);
  const dateFrom = strOrUndef(params.from);
  const dateTo = strOrUndef(params.to);
  const amountMin = numOrUndef(params.min);
  const amountMax = numOrUndef(params.max);
  const offset = numOrUndef(params.offset) ?? 0;

  const { rows, total } = await searchReceipts({
    query,
    kinds,
    vendorMatch: vendor,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    limit: 50,
    offset,
  });

  return (
    <div>
      <Masthead section="RECEIPTS" />
      <SectionDivider label={`${total} results`} />
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Search</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiptsClient
              initial={{
                query: query ?? '',
                kinds: kinds ?? [],
                vendor: vendor ?? '',
                dateFrom: dateFrom ?? '',
                dateTo: dateTo ?? '',
                amountMin: amountMin ?? null,
                amountMax: amountMax ?? null,
              }}
              rows={rows}
              total={total}
              offset={offset}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
