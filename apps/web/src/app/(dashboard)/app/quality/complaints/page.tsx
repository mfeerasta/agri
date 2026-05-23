import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listComplaints } from '@/modules/quality/actions';

export const dynamic = 'force-dynamic';

const COLUMNS: Array<{ key: 'open' | 'investigating' | 'resolved' | 'escalated'; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'escalated', label: 'Escalated' },
];

export default async function ComplaintsPage() {
  const ctx = await getSessionContext();
  const rows = ctx?.entityId ? await listComplaints(ctx.entityId) : [];

  const grouped = COLUMNS.map((c) => ({
    ...c,
    items: rows.filter((r) => r.status === c.key),
  }));

  return (
    <div className="space-y-2">
      <Masthead section="Quality complaints" />
      <SectionDivider />
      <p className="text-sm text-slate-500">
        Complaint resolutions above the farm-manager threshold (PKR 50,000) are routed through the
        approval engine automatically.
      </p>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((col) => (
          <Card key={col.key}>
            <CardHeader>
              <CardTitle>
                {col.label} ({col.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {col.items.map((it) => (
                <div key={it.id} className="border rounded p-2 text-sm">
                  <div className="font-medium">{it.raisedByBuyer}</div>
                  <div className="text-xs text-slate-500">
                    {it.raisedOn} - {it.complaintKind ?? 'unspecified'} - {it.severity}
                  </div>
                  <div className="text-xs">
                    Claimed: PKR {it.claimedLossPkr ? Number(it.claimedLossPkr).toLocaleString() : '0'}
                  </div>
                  {it.resolution && (
                    <div className="text-xs text-emerald-700">
                      {it.resolution}: PKR {it.resolvedPkr ? Number(it.resolvedPkr).toLocaleString() : '0'}
                    </div>
                  )}
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="text-xs text-slate-400 py-2 text-center">None</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
