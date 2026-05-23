import { desc, eq } from 'drizzle-orm';
import { db, carbonCredits } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { CARBON_CREDIT_STANDARDS } from '@zameen/shared';
import {
  issueCarbonCredits,
  proposeCarbonCreditSale,
  retireCarbonCredits,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const rows = entityId
    ? await db
        .select()
        .from(carbonCredits)
        .where(eq(carbonCredits.entityId, entityId))
        .orderBy(desc(carbonCredits.createdAt))
        .limit(200)
    : [];

  async function issueAction(formData: FormData) {
    'use server';
    await issueCarbonCredits({
      entityId: formData.get('entityId'),
      creditNumber: (formData.get('creditNumber') as string) || undefined,
      issuedBy: (formData.get('issuedBy') as string) || undefined,
      standard: formData.get('standard'),
      issuedOn: (formData.get('issuedOn') as string) || undefined,
      vintageYear: Number(formData.get('vintageYear')),
      quantityTco2e: Number(formData.get('quantityTco2e')),
      certificateUrl: (formData.get('certificateUrl') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    });
  }

  async function sellAction(formData: FormData) {
    'use server';
    await proposeCarbonCreditSale({
      creditId: formData.get('creditId'),
      soldTo: formData.get('soldTo'),
      soldOn: formData.get('soldOn'),
      soldPricePerTonPkr: Number(formData.get('soldPricePerTonPkr')),
    });
  }

  async function retireAction(formData: FormData) {
    'use server';
    await retireCarbonCredits({
      creditId: formData.get('creditId'),
      retirementReason: formData.get('retirementReason'),
    });
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Carbon credits" subtitle="Issuance, sale, and retirement" />

      <Card>
        <CardHeader>
          <CardTitle>Issue credits</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={issueAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="hidden" name="entityId" value={entityId} />
            <label className="text-sm">
              Standard
              <select required name="standard" className="block w-full border rounded p-2 text-sm">
                {CARBON_CREDIT_STANDARDS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Vintage year
              <input required type="number" min="1990" max="2100" name="vintageYear" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Quantity (tCO2e)
              <input required type="number" min="0" step="0.001" name="quantityTco2e" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Credit number
              <input name="creditNumber" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Issued by
              <input name="issuedBy" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Issued on
              <input type="date" name="issuedOn" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-3">
              Certificate URL
              <input type="url" name="certificateUrl" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-3">
              Notes
              <textarea name="notes" rows={2} className="block w-full border rounded p-2 text-sm" />
            </label>
            <div className="md:col-span-3">
              <button type="submit" className="rounded bg-emerald-700 text-white px-3 py-2 text-sm">
                Issue credits
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No credits" description="Issue your first credit batch above." />
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1">Number</th>
                  <th>Standard</th>
                  <th>Vintage</th>
                  <th>Quantity (t)</th>
                  <th>Status</th>
                  <th>Buyer</th>
                  <th>Revenue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-1">{r.creditNumber ?? '—'}</td>
                    <td>{r.standard ?? '—'}</td>
                    <td>{r.vintageYear}</td>
                    <td>{Number(r.quantityTco2e).toFixed(2)}</td>
                    <td>{r.status}</td>
                    <td>{r.soldTo ?? '—'}</td>
                    <td>{r.totalRevenuePkr ? <Pkr value={Math.round(Number(r.totalRevenuePkr) * 100)} /> : '—'}</td>
                    <td>
                      {r.status === 'issued' && (
                        <div className="space-y-2">
                          <form action={sellAction} className="grid grid-cols-2 gap-1 mb-2">
                            <input type="hidden" name="creditId" value={r.id} />
                            <input required placeholder="Buyer" name="soldTo" className="border rounded p-1 text-xs" />
                            <input required type="date" name="soldOn" className="border rounded p-1 text-xs" />
                            <input required type="number" min="0" step="0.01" placeholder="PKR / ton" name="soldPricePerTonPkr" className="border rounded p-1 text-xs col-span-2" />
                            <button type="submit" className="col-span-2 text-xs bg-emerald-700 text-white rounded px-1 py-0.5">
                              Propose sale (route through approval)
                            </button>
                          </form>
                          <form action={retireAction} className="grid grid-cols-1 gap-1">
                            <input type="hidden" name="creditId" value={r.id} />
                            <input required placeholder="Retirement reason" name="retirementReason" className="border rounded p-1 text-xs" />
                            <button type="submit" className="text-xs bg-zinc-700 text-white rounded px-1 py-0.5">
                              Retire
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
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
