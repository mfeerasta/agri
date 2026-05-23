import { and, eq } from 'drizzle-orm';
import { db, biosecurityProtocols } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { ProtocolForm } from './protocol-form';
import { ToggleButton } from './toggle-button';

export const dynamic = 'force-dynamic';

export default async function ProtocolsPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const rows = entityId
    ? await db.select().from(biosecurityProtocols).where(eq(biosecurityProtocols.entityId, entityId))
    : [];

  const byZone = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byZone.get(r.zone) ?? [];
    list.push(r);
    byZone.set(r.zone, list);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Masthead title="Biosecurity protocols" subtitle="Mandatory and recommended rules by zone" />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>New protocol</CardTitle>
        </CardHeader>
        <CardContent>
          <ProtocolForm />
        </CardContent>
      </Card>

      {[...byZone.entries()].map(([zone, list]) => (
        <Card key={zone} className="mt-4">
          <CardHeader>
            <CardTitle>{zone}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Kind</th>
                  <th>Enforcement</th>
                  <th>Applies to</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">{p.protocolName}</td>
                    <td>{p.protocolKind}</td>
                    <td>
                      <span
                        className={
                          p.enforcementLevel === 'mandatory'
                            ? 'rounded bg-red-100 px-2 py-0.5 text-xs text-red-800'
                            : 'rounded bg-slate-100 px-2 py-0.5 text-xs'
                        }
                      >
                        {p.enforcementLevel}
                      </span>
                    </td>
                    <td>{(p.appliesTo ?? []).join(', ')}</td>
                    <td>
                      <ToggleButton id={p.id} isActive={p.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {rows.length === 0 && (
        <Card className="mt-4">
          <CardContent>
            <p className="text-sm text-slate-500">No protocols defined yet.</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
