import { desc, eq } from 'drizzle-orm';
import { db, sustainabilityPractices } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { SUSTAINABILITY_PRACTICE_KINDS } from '@zameen/shared';
import {
  createSustainabilityPractice,
  deactivateSustainabilityPractice,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function PracticesPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const rows = entityId
    ? await db
        .select()
        .from(sustainabilityPractices)
        .where(eq(sustainabilityPractices.entityId, entityId))
        .orderBy(desc(sustainabilityPractices.createdAt))
        .limit(200)
    : [];

  async function createAction(formData: FormData) {
    'use server';
    const evidenceRaw = (formData.get('evidenceUrls') as string) || '';
    const evidenceUrls = evidenceRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await createSustainabilityPractice({
      entityId: formData.get('entityId'),
      fieldId: (formData.get('fieldId') as string) || null,
      practiceKind: formData.get('practiceKind'),
      startedOn: formData.get('startedOn'),
      endedOn: (formData.get('endedOn') as string) || null,
      areaAcres: formData.get('areaAcres') ? Number(formData.get('areaAcres')) : null,
      evidenceUrls,
      verifier: (formData.get('verifier') as string) || null,
      certification: (formData.get('certification') as string) || null,
      notes: (formData.get('notes') as string) || null,
    });
  }

  async function deactivateAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deactivateSustainabilityPractice(id);
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Sustainability practices" subtitle="Regenerative practices in use" />

      <Card>
        <CardHeader>
          <CardTitle>Register a practice</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="hidden" name="entityId" value={entityId} />
            <label className="text-sm">
              Practice kind
              <select name="practiceKind" required className="block w-full border rounded p-2 text-sm">
                {SUSTAINABILITY_PRACTICE_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Field id (optional)
              <input name="fieldId" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Started on
              <input type="date" required name="startedOn" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Ended on (optional)
              <input type="date" name="endedOn" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Area (acres)
              <input type="number" step="0.001" min="0" name="areaAcres" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Certification
              <input name="certification" className="block w-full border rounded p-2 text-sm" placeholder="e.g. Verra VM0042" />
            </label>
            <label className="text-sm">
              Verifier
              <input name="verifier" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-2">
              Evidence URLs (whitespace-separated)
              <textarea name="evidenceUrls" rows={2} className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-2">
              Notes
              <textarea name="notes" rows={2} className="block w-full border rounded p-2 text-sm" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded bg-emerald-700 text-white px-3 py-2 text-sm">
                Register practice
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered practices</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No practices yet" description="Register your first regenerative practice above." />
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1">Kind</th>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Acres</th>
                  <th>Certification</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.practiceKind}</td>
                    <td>{r.startedOn}</td>
                    <td>{r.endedOn ?? '—'}</td>
                    <td>{r.areaAcres ?? '—'}</td>
                    <td>{r.certification ?? '—'}</td>
                    <td>{r.isActive ? 'yes' : 'no'}</td>
                    <td>
                      {r.isActive && (
                        <form action={deactivateAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-xs underline text-red-700" type="submit">deactivate</button>
                        </form>
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
