import { db, workers, fields } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { createSafetyIncident } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewSafetyIncidentPage() {
  const [roster, fieldList] = await Promise.all([
    db.select({ id: workers.id, code: workers.code, fullName: workers.fullName }).from(workers).where(eq(workers.isActive, true)).orderBy(workers.fullName),
    db.select({ id: fields.id, name: fields.name }).from(fields).limit(500),
  ]);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <div>
      <Masthead section="REPORT INCIDENT" />
      <SectionDivider />
      <Card>
        <CardContent>
          <form action={createSafetyIncident} className="grid gap-4 max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="smallcaps text-[0.7rem]">When · کب</span>
                <input name="occurredAt" type="datetime-local" defaultValue={nowLocal} required className="block w-full border border-[var(--rule)] px-2 py-2 mt-1" />
              </label>
              <label className="block">
                <span className="smallcaps text-[0.7rem]">Severity · شدت</span>
                <select name="severity" required className="block w-full border border-[var(--rule)] px-2 py-2 mt-1">
                  <option value="near_miss">Near miss</option>
                  <option value="first_aid">First aid</option>
                  <option value="medical_treatment">Medical treatment</option>
                  <option value="lost_time">Lost time</option>
                  <option value="fatality">Fatality</option>
                  <option value="property_only">Property only</option>
                </select>
              </label>
              <label className="block">
                <span className="smallcaps text-[0.7rem]">Category · قسم</span>
                <select name="category" className="block w-full border border-[var(--rule)] px-2 py-2 mt-1">
                  <option value="">—</option>
                  <option value="pesticide_exposure">Pesticide exposure</option>
                  <option value="machinery">Machinery</option>
                  <option value="heat_stress">Heat stress</option>
                  <option value="fall">Fall</option>
                  <option value="animal">Animal</option>
                  <option value="electrical">Electrical</option>
                  <option value="fire">Fire</option>
                  <option value="snake_bite">Snake bite</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="smallcaps text-[0.7rem]">Worker · مزدور</span>
                <select name="workerId" className="block w-full border border-[var(--rule)] px-2 py-2 mt-1">
                  <option value="">—</option>
                  {roster.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.fullName}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="smallcaps text-[0.7rem]">Field · کھیت</span>
                <select name="fieldId" className="block w-full border border-[var(--rule)] px-2 py-2 mt-1">
                  <option value="">—</option>
                  {fieldList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="smallcaps text-[0.7rem]">Lost days</span>
                <input name="lostDays" type="number" min={0} defaultValue={0} className="block w-full border border-[var(--rule)] px-2 py-2 mt-1" />
              </label>
            </div>

            <label className="block">
              <span className="smallcaps text-[0.7rem]">Description · تفصیل</span>
              <textarea name="description" required rows={4} className="block w-full border border-[var(--rule)] px-2 py-2 mt-1" placeholder="What happened?" />
            </label>

            <label className="block">
              <span className="smallcaps text-[0.7rem]">Immediate action taken · فوری اقدام</span>
              <textarea name="immediateActionTaken" rows={2} className="block w-full border border-[var(--rule)] px-2 py-2 mt-1" />
            </label>

            <label className="block">
              <span className="smallcaps text-[0.7rem]">Photo URLs (one per line) · تصاویر — required</span>
              <textarea name="photoUrls" required rows={3} className="block w-full border border-[var(--rule)] px-2 py-2 mt-1 font-mono text-xs" />
            </label>

            <label className="flex items-center gap-2">
              <input name="medicalAttentionRequired" type="checkbox" />
              <span className="text-sm">Medical attention required · طبی امداد درکار</span>
            </label>

            <div className="flex gap-2">
              <button type="submit" className="border border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] px-4 py-2 smallcaps text-xs">Submit incident</button>
              <a href="/labor/safety" className="border border-[var(--rule)] px-4 py-2 smallcaps text-xs">Cancel</a>
            </div>
            <p className="text-xs text-[var(--ink)]/60">Severity at or above &quot;medical_treatment&quot; notifies the director within one hour and auto-creates a 7-day corrective action.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
