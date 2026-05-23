import { db, auditorExportPacks } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '../../../../../lib/session';
import { CreatePackForm } from './create-pack-form';
import { DownloadButton } from './download-button';

export const dynamic = 'force-dynamic';

function fmtBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default async function AuditorPacksPage() {
  const session = await getSessionContext();
  if (!session) return null;
  const packs = await db
    .select()
    .from(auditorExportPacks)
    .where(eq(auditorExportPacks.entityId, session.entityId))
    .orderBy(desc(auditorExportPacks.createdAt));

  return (
    <div>
      <Masthead section="AUDITOR PACKS" />
      <SectionDivider />
      <div className="space-y-4">
        <CreatePackForm />
        <Card>
          <CardHeader>
            <CardTitle>{packs.length} packs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Period</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Scope</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Size</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Downloads</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Action</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">
                      {p.periodStart} → {p.periodEnd}
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{p.scope}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{p.status}</td>
                    <td className="px-3 py-2 text-right tabular text-xs">{fmtBytes(p.sizeBytes)}</td>
                    <td className="px-3 py-2 text-right tabular text-xs">{p.downloadCount}</td>
                    <td className="px-3 py-2 tabular text-xs">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === 'ready' ? <DownloadButton packId={p.id} /> : '—'}
                    </td>
                  </tr>
                ))}
                {packs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[var(--fg-muted)] text-sm">
                      No packs yet. Create one above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
