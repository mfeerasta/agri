import Link from 'next/link';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db, visitors, diseaseOutbreaks } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, StatBlock } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function GatePage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayVisitors = entityId
    ? await db
        .select()
        .from(visitors)
        .where(and(eq(visitors.entityId, entityId), gte(visitors.signedInAt, startOfDay)))
        .orderBy(sql`${visitors.signedInAt} desc`)
    : [];

  const onSite = todayVisitors.filter((v) => v.signedOutAt === null);

  const activeOutbreaks = entityId
    ? await db
        .select()
        .from(diseaseOutbreaks)
        .where(and(eq(diseaseOutbreaks.entityId, entityId), sql`${diseaseOutbreaks.status} in ('suspected','active')`))
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Masthead title="Gate" subtitle="Visitor sign-in and biosecurity" />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBlock label="Today" value={String(todayVisitors.length)} />
        <StatBlock label="On site" value={String(onSite.length)} />
        <StatBlock label="Bio failed today" value={String(todayVisitors.filter((v) => !v.biosecurityCheckPassed).length)} />
        <StatBlock label="Active outbreaks" value={String(activeOutbreaks.length)} />
      </div>

      {activeOutbreaks.length > 0 && (
        <Card className="mt-4 border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle>Active outbreak — restrict access</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-red-900">
              {activeOutbreaks.map((o) => (
                <li key={o.id}>
                  <strong>{o.outbreakKind.toUpperCase()}</strong> detected {o.detectedOn} — {o.affectedArea ?? 'area unspecified'}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <Link href="/gate/new" className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm">
          Sign in visitor
        </Link>
        <Link href="/biosecurity/protocols" className="rounded-md border px-4 py-2">
          Protocols
        </Link>
        <Link href="/biosecurity/outbreaks" className="rounded-md border px-4 py-2">
          Outbreaks
        </Link>
        <Link href="/biosecurity/quarantine" className="rounded-md border px-4 py-2">
          Quarantine
        </Link>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>On site now</CardTitle>
        </CardHeader>
        <CardContent>
          {onSite.length === 0 ? (
            <p className="text-sm text-slate-500">No visitors currently on site.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Purpose</th>
                  <th>Vehicle</th>
                  <th>In</th>
                  <th>Bio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {onSite.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-2">
                      {v.visitorName}
                      {v.organization ? <span className="text-slate-500"> · {v.organization}</span> : null}
                    </td>
                    <td>{v.visitPurpose}</td>
                    <td>{v.vehicleRegistration ?? '-'}</td>
                    <td>{new Date(v.signedInAt as unknown as string).toLocaleTimeString()}</td>
                    <td>
                      {v.biosecurityCheckPassed ? (
                        <span className="text-emerald-700">pass</span>
                      ) : (
                        <span className="text-red-700">fail</span>
                      )}
                    </td>
                    <td>
                      <form
                        action={async () => {
                          'use server';
                          const { signOutVisitor } = await import('./actions');
                          await signOutVisitor(v.id);
                        }}
                      >
                        <button type="submit" className="rounded border px-2 py-1 text-xs">
                          Sign out
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Today (all)</CardTitle>
        </CardHeader>
        <CardContent>
          {todayVisitors.length === 0 ? (
            <p className="text-sm text-slate-500">No visitors today.</p>
          ) : (
            <ul className="divide-y text-sm">
              {todayVisitors.map((v) => (
                <li key={v.id} className="py-2">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">{v.visitorName}</div>
                      <div className="text-xs text-slate-500">
                        {v.visitPurpose} · in {new Date(v.signedInAt as unknown as string).toLocaleTimeString()}
                        {v.signedOutAt ? ` · out ${new Date(v.signedOutAt as unknown as string).toLocaleTimeString()}` : ''}
                      </div>
                    </div>
                    <div className={v.biosecurityCheckPassed ? 'text-emerald-700' : 'text-red-700'}>
                      {v.biosecurityCheckPassed ? 'pass' : 'fail'}
                    </div>
                  </div>
                  {v.biosecurityFailures && v.biosecurityFailures.length > 0 && (
                    <div className="mt-1 text-xs text-red-700">{v.biosecurityFailures.join(' · ')}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
