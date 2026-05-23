import { db, ntnStrnRecords } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { upsertNtnStrn } from '@/lib/finance/tax-actions';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NtnStrnPage() {
  const rows = await db.select().from(ntnStrnRecords).orderBy(desc(ntnStrnRecords.registrationDate)).limit(50);

  return (
    <div>
      <Masthead section="NTN / STRN REGISTRATIONS" />
      <SectionDivider label="FBR Iris profile reference: https://iris.fbr.gov.pk" />

      <Card>
        <CardHeader><CardTitle>Add registration record</CardTitle></CardHeader>
        <CardContent>
          <form action={upsertNtnStrn} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">NTN</span>
              <input name="ntn" className="w-full border rounded px-2 py-1 font-mono" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">STRN</span>
              <input name="strn" className="w-full border rounded px-2 py-1 font-mono" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">CNIC of principal</span>
              <input name="cnicOfPrincipal" className="w-full border rounded px-2 py-1 font-mono" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">FBR principal activity</span>
              <input name="fbrPrincipalActivity" className="w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Registration date</span>
              <input name="registrationDate" type="date" className="w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">PRA registration ID</span>
              <input name="praRegistrationId" className="w-full border rounded px-2 py-1 font-mono" />
            </label>
            <label className="block sm:col-span-3">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Notes</span>
              <input name="notes" className="w-full border rounded px-2 py-1" />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">
                Save registration
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SectionDivider label="On record" />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No NTN/STRN records yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">NTN</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">STRN</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Principal CNIC</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Activity</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Reg date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">PRA ID</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{r.ntn ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.strn ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.cnicOfPrincipal ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.fbrPrincipalActivity ?? '—'}</td>
                    <td className="px-3 py-2 tabular text-xs">{r.registrationDate ? fmtDate(r.registrationDate) : '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.praRegistrationId ?? '—'}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.status}</td>
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
