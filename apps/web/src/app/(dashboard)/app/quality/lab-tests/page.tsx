import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listLabTests } from '@/modules/quality/actions';

export const dynamic = 'force-dynamic';

export default async function LabTestsPage() {
  const ctx = await getSessionContext();
  const rows = ctx?.entityId ? await listLabTests(ctx.entityId) : [];

  return (
    <div className="space-y-2">
      <Masthead section="Lab tests" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Recent results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-2">
            Upload a lab report PDF and Claude vision can auto-extract result values. Manual entry below.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th>Lot</th>
                  <th>Crop</th>
                  <th>Test</th>
                  <th>Result</th>
                  <th>Lab</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.testedOn}</td>
                    <td>{r.lotNumber ?? '-'}</td>
                    <td>{r.cropName ?? '-'}</td>
                    <td>{r.testKind}</td>
                    <td>
                      {r.resultValue ?? '-'} {r.resultUnit ?? ''}
                    </td>
                    <td>{r.laboratory ?? '-'}</td>
                    <td>{r.resultPassFail ?? '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      No tests recorded yet.
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
