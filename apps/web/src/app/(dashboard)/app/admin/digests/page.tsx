import { db, digestSubscriptions, entities } from '@zameen/db';
import { asc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { DigestEditor } from '@/modules/digests/digest-editor';
import { DigestSendTestButton } from '@/modules/digests/digest-send-test-button';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DigestsAdminPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const entityRows = await db.select({ id: entities.id, name: entities.name }).from(entities).orderBy(asc(entities.name));
  const subs = await db
    .select()
    .from(digestSubscriptions)
    .orderBy(asc(digestSubscriptions.entityId), asc(digestSubscriptions.kind));

  return (
    <div>
      <Masthead section="DIGESTS" />
      <SectionDivider />

      <Card>
        <CardHeader>
          <CardTitle>{subs.length} active digest{subs.length === 1 ? '' : 's'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {subs.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">
              No digest subscriptions. Add one below to start receiving daily ops or weekly summaries.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Entity</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Channel</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Target</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Send time</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Last sent</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const e = entityRows.find((r) => r.id === s.entityId);
                  return (
                    <tr key={s.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2">{e?.name ?? s.entityId}</td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{s.channel}</td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{s.kind}</td>
                      <td className="px-3 py-2 font-mono text-[0.7rem] truncate max-w-[200px]">
                        {s.channel === 'slack' ? maskWebhook(s.target) : s.target}
                      </td>
                      <td className="px-3 py-2 font-mono text-[0.7rem]">{s.sendTimeLocal} {s.timezone}</td>
                      <td className="px-3 py-2 text-[0.75rem] text-[var(--ink)]/70">
                        {s.lastSentAt ? new Date(s.lastSentAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-3 py-2">
                        <DigestSendTestButton subscriptionId={s.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider />

      <Card>
        <CardHeader>
          <CardTitle>Add digest subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <DigestEditor entities={entityRows} />
        </CardContent>
      </Card>
    </div>
  );
}

function maskWebhook(url: string): string {
  if (!url.includes('hooks.slack.com')) return url.slice(0, 32) + '…';
  return url.replace(/(T[A-Z0-9]+\/B[A-Z0-9]+\/)[A-Za-z0-9]+/, '$1•••');
}
