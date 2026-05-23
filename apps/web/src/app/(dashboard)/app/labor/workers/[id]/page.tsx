import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import {
  db,
  workers,
  workerDocuments,
  trainingCompletions,
  trainingPrograms,
  ppeIssuances,
  safetyIncidents,
} from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);

  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) {
    return (
      <div>
        <Masthead section="WORKER" />
        <SectionDivider />
        <div className="p-6 text-sm text-[var(--ink)]/60">Worker not found.</div>
      </div>
    );
  }

  const [docs, completions, ppe, incidents] = await Promise.all([
    db.select().from(workerDocuments).where(eq(workerDocuments.workerId, id)).orderBy(desc(workerDocuments.createdAt)),
    db
      .select({
        id: trainingCompletions.id,
        completedOn: trainingCompletions.completedOn,
        expiresOn: trainingCompletions.expiresOn,
        passed: trainingCompletions.passed,
        scorePct: trainingCompletions.scorePct,
        trainerName: trainingCompletions.trainerName,
        certificateUrl: trainingCompletions.certificateUrl,
        programName: trainingPrograms.name,
        programCategory: trainingPrograms.category,
      })
      .from(trainingCompletions)
      .innerJoin(trainingPrograms, eq(trainingPrograms.id, trainingCompletions.programId))
      .where(eq(trainingCompletions.workerId, id))
      .orderBy(desc(trainingCompletions.completedOn)),
    db.select().from(ppeIssuances).where(eq(ppeIssuances.workerId, id)).orderBy(desc(ppeIssuances.issuedOn)),
    db.select().from(safetyIncidents).where(eq(safetyIncidents.workerId, id)).orderBy(desc(safetyIncidents.occurredAt)),
  ]);

  return (
    <div>
      <Masthead section="WORKER" />
      <SectionDivider />
      <div className="mb-4">
        <div className="font-display text-2xl">{worker.fullName}{worker.fullNameUr ? <span className="urdu mx-3 opacity-70">{worker.fullNameUr}</span> : null}</div>
        <div className="text-xs text-[var(--ink)]/60 mt-1">
          <span className="font-mono">{worker.code}</span> · {worker.workerType} · {worker.isActive ? 'active' : 'inactive'} · hired {fmtDate(worker.hireDate)}
        </div>
      </div>

      <SectionDivider label="Documents" />
      <div className="flex justify-end mb-2">
        <Link href={`/labor/workers/${id}/documents/new` as never} className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] hover:bg-[var(--ink)] hover:text-[var(--paper)]">Add document</Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No documents on file.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Reference</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Issued</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">File</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const expired = d.expiresOn && d.expiresOn < today;
                  return (
                    <tr key={d.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{d.docKind ?? d.documentKind ?? 'other'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{d.referenceNumber ?? ''}</td>
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(d.issuedOn)}</td>
                      <td className={`px-3 py-2 tabular text-xs ${expired ? 'text-rose-700' : ''}`}>{fmtDate(d.expiresOn)}{expired ? ' (expired)' : ''}</td>
                      <td className="px-3 py-2"><a className="hover:underline" href={d.storageUrl ?? d.fileUrl ?? '#'} target="_blank" rel="noreferrer">view</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Training history" />
      <Card>
        <CardContent className="p-0">
          {completions.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No training records.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Program</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Completed</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Score</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Passed</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Trainer</th>
                </tr>
              </thead>
              <tbody>
                {completions.map((c) => {
                  const expired = c.expiresOn && c.expiresOn < today;
                  return (
                    <tr key={c.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2">{c.programName}<div className="text-[var(--ink)]/50 text-[0.65rem] smallcaps">{c.programCategory}</div></td>
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(c.completedOn)}</td>
                      <td className={`px-3 py-2 tabular text-xs ${expired ? 'text-rose-700' : ''}`}>{fmtDate(c.expiresOn)}{expired ? ' (expired)' : ''}</td>
                      <td className="px-3 py-2 text-right tabular">{c.scorePct ?? ''}</td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{c.passed ? 'yes' : 'no'}</td>
                      <td className="px-3 py-2 text-xs">{c.trainerName ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="PPE issued" />
      <Card>
        <CardContent className="p-0">
          {ppe.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No PPE issued.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">PPE</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Issued</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Qty</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Ack</th>
                </tr>
              </thead>
              <tbody>
                {ppe.map((p) => {
                  const expired = p.expiresOn && p.expiresOn < today;
                  return (
                    <tr key={p.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{p.ppeKind}</td>
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(p.issuedOn)}</td>
                      <td className="px-3 py-2 text-right tabular">{p.quantity}</td>
                      <td className={`px-3 py-2 tabular text-xs ${expired ? 'text-rose-700' : ''}`}>{fmtDate(p.expiresOn)}{expired ? ' (expired)' : ''}</td>
                      <td className="px-3 py-2 text-right">{p.costPkr ? <Pkr value={p.costPkr} /> : null}</td>
                      <td className="px-3 py-2 text-xs">{p.acknowledgementSigned ? 'signed' : 'pending'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Safety incidents" />
      <Card>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No safety incidents recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Severity</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Description</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Lost days</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(i.occurredAt)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.severity}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.category ?? ''}</td>
                    <td className="px-3 py-2 text-xs max-w-md truncate">{i.description}</td>
                    <td className="px-3 py-2 text-right tabular">{i.lostDays}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.status}</td>
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
