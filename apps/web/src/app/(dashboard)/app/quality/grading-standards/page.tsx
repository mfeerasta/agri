import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listGradingStandards } from '@/modules/quality/actions';

export const dynamic = 'force-dynamic';

export default async function GradingStandardsPage() {
  const ctx = await getSessionContext();
  const rows = ctx?.entityId ? await listGradingStandards(ctx.entityId) : [];

  return (
    <div className="space-y-2">
      <Masthead section="Grading standards" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Active criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-2">
            Defaults seeded with PASSCO wheat, PSQCA rice, and PCSI cotton grades. Entity-specific
            overrides and buyer-specific variants can be added per crop.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Crop</th>
                  <th>Grade</th>
                  <th>Buyer</th>
                  <th>Criteria</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-1">{r.cropCode}</td>
                    <td>{r.grade}</td>
                    <td>{r.buyerSpecific ?? 'generic'}</td>
                    <td>
                      <code className="text-xs">{JSON.stringify(r.criteria)}</code>
                    </td>
                    <td>{r.entityId ? 'entity' : 'global'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      No standards loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
