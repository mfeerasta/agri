import Link from 'next/link';
import { db, signingEnvelopes, envelopeSigners } from '@zameen/db';
import { desc, eq, sql } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

const STATUSES = ['all', 'draft', 'sent', 'partially_signed', 'completed', 'declined', 'expired', 'voided'] as const;

export default async function SigningEnvelopesPage(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const filter = sp.status && STATUSES.includes(sp.status as never) ? sp.status : 'all';

  const baseQuery = db
    .select({
      id: signingEnvelopes.id,
      number: signingEnvelopes.envelopeNumber,
      title: signingEnvelopes.title,
      kind: signingEnvelopes.documentKind,
      status: signingEnvelopes.status,
      createdAt: signingEnvelopes.createdAt,
      expiresAt: signingEnvelopes.expiresAt,
      signerCount: sql<number>`(select count(*)::int from zameen.envelope_signers s where s.envelope_id = ${signingEnvelopes.id})`,
      signedCount: sql<number>`(select count(*)::int from zameen.envelope_signers s where s.envelope_id = ${signingEnvelopes.id} and s.status = 'signed')`,
    })
    .from(signingEnvelopes)
    .orderBy(desc(signingEnvelopes.createdAt));

  const rows = filter === 'all' ? await baseQuery : await baseQuery.where(eq(signingEnvelopes.status, filter));

  return (
    <div>
      <Masthead section="E-SIGNING" />
      <SectionDivider />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={s === 'all' ? '/app/admin/signing' : `/app/admin/signing?status=${s}`}
              className={`smallcaps text-[0.7rem] px-2 py-1 border ${
                filter === s ? 'bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule)]'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
        <Link href="/app/admin/signing/new" className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)]">
          New envelope
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} envelope{rows.length === 1 ? '' : 's'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/60">No envelopes in this view.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Number</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Title</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Signed</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)] hover:bg-[var(--paper-2)]/40">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/app/admin/signing/${r.id}`} className="underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.kind.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.status.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.signedCount}/{r.signerCount}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
