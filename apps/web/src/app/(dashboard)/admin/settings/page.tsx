import { db, entitySettings } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const rows = await db.select().from(entitySettings).limit(10);
  return (
    <div>
      <Masthead section="SETTINGS" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Entity settings</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <div className="text-sm text-[var(--ink)]/50">No entity settings yet.</div> : (
            <pre className="font-mono text-xs bg-[var(--paper-2)] p-4 overflow-auto">{JSON.stringify(rows, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
