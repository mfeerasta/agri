import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, complianceDocuments } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { RenewActions } from './renew-actions';

export const dynamic = 'force-dynamic';

export default async function ComplianceDocumentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc] = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, id));
  if (!doc) return notFound();

  let supersededBy: typeof doc | null = null;
  if (doc.supersededById) {
    const [sb] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, doc.supersededById));
    supersededBy = sb ?? null;
  }

  return (
    <div>
      <Masthead section={doc.title.toUpperCase()} />
      <SectionDivider />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Kind" value={doc.docKind} />
            <Row label="Reference" value={doc.referenceNumber ?? '—'} />
            <Row label="Issuing authority" value={doc.issuingAuthority ?? '—'} />
            <Row label="Issued on" value={fmtDate(doc.issuedOn) ?? '—'} />
            <Row label="Expires on" value={fmtDate(doc.expiresOn) ?? '—'} />
            <Row label="Status" value={doc.status} />
            <Row
              label="File"
              value={
                <a className="underline" href={doc.storageUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              }
            />
            {doc.notes ? <Row label="Notes" value={doc.notes} /> : null}
            {supersededBy ? (
              <Row
                label="Superseded by"
                value={
                  <Link
                    href={`/compliance/documents/${supersededBy.id}` as never}
                    className="underline"
                  >
                    {supersededBy.title}
                  </Link>
                }
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <RenewActions
              docId={doc.id}
              entityId={doc.entityId}
              docKind={doc.docKind}
              currentStatus={doc.status}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-[var(--rule)] py-1">
      <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
