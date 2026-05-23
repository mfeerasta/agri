import { notFound } from 'next/navigation';
import { db, signingEnvelopes, envelopeSigners, signatureAuditEvents } from '@zameen/db';
import { asc, desc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { EnvelopeActions } from './envelope-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EnvelopeDetailPage(props: PageProps) {
  const { id } = await props.params;
  const [env] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, id));
  if (!env) return notFound();
  const signers = await db
    .select()
    .from(envelopeSigners)
    .where(eq(envelopeSigners.envelopeId, id))
    .orderBy(asc(envelopeSigners.signingOrder));
  const audit = await db
    .select()
    .from(signatureAuditEvents)
    .where(eq(signatureAuditEvents.envelopeId, id))
    .orderBy(desc(signatureAuditEvents.eventAt))
    .limit(200);

  const signedCount = signers.filter((s) => s.status === 'signed').length;

  return (
    <div>
      <Masthead section={`ENVELOPE ${env.envelopeNumber}`} />
      <SectionDivider />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{env.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind" value={env.documentKind.replace(/_/g, ' ')} />
              <Field label="Status" value={env.status.replace(/_/g, ' ')} />
              <Field label="Signed" value={`${signedCount} / ${signers.length}`} />
              <Field label="Created" value={env.createdAt.toISOString().slice(0, 16).replace('T', ' ')} />
              <Field label="Expires" value={env.expiresAt ? env.expiresAt.toISOString().slice(0, 10) : '—'} />
              <Field label="Completed" value={env.completedAt ? env.completedAt.toISOString().slice(0, 16).replace('T', ' ') : '—'} />
            </div>
            <div>
              <div className="smallcaps text-[0.65rem] text-[var(--ink)]/50">PDF sha256</div>
              <div className="font-mono text-[0.65rem] break-all">{env.pdfSha256}</div>
            </div>
            {env.signedPdfSha256 ? (
              <div>
                <div className="smallcaps text-[0.65rem] text-[var(--ink)]/50">Signed PDF anchor</div>
                <div className="font-mono text-[0.65rem] break-all">{env.signedPdfSha256}</div>
              </div>
            ) : null}
            <EnvelopeActions envelopeId={env.id} status={env.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul>
              {signers.map((s) => (
                <li key={s.id} className="border-b border-[var(--rule)] last:border-b-0 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">#{s.signingOrder} {s.signerName}</div>
                      <div className="text-[0.7rem] text-[var(--ink)]/60 smallcaps">{s.signerRole}</div>
                    </div>
                    <div className="smallcaps text-[0.65rem]">{s.status.replace(/_/g, ' ')}</div>
                  </div>
                  <div className="text-[0.7rem] text-[var(--ink)]/60 mt-1">
                    {s.signerEmail ?? ''} {s.signerPhone ? ` · ${s.signerPhone}` : ''}
                  </div>
                  {s.signedAt ? (
                    <div className="text-[0.7rem] text-[var(--ink)]/60 mt-1">
                      Signed {s.signedAt.toISOString().slice(0, 16).replace('T', ' ')} from {s.ipAddress ?? 'unknown IP'}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Audit trail ({audit.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Event</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">IP</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">User agent</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-1.5 font-mono">{a.eventAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td className="px-3 py-1.5 smallcaps">{a.eventKind.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-1.5 font-mono">{a.ipAddress ?? '—'}</td>
                  <td className="px-3 py-1.5 truncate max-w-[280px]">{a.userAgent ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="smallcaps text-[0.65rem] text-[var(--ink)]/50">{label}</div>
      <div>{value}</div>
    </div>
  );
}
