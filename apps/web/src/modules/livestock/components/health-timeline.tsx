'use client';
import * as React from 'react';
import { BigButton, Card, Button, Input, Pkr, PhotoUploader } from '@zameen/ui';
import { logHealthEvent, type HealthEventKind, type HealthEventRow } from '../health-actions';

export interface HealthTimelineProps {
  events: HealthEventRow[];
  animalsList: Array<{ id: string; earTag: string; species: string }>;
  upcoming: HealthEventRow[];
}

const KINDS: HealthEventKind[] = ['vaccination', 'treatment', 'illness', 'injury', 'deworming', 'hoof_trim', 'death'];
const PHOTO_REQUIRED: HealthEventKind[] = ['treatment', 'illness', 'injury', 'death'];

export function HealthTimeline({ events, animalsList, upcoming }: HealthTimelineProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const [animalId, setAnimalId] = React.useState<string>(animalsList[0]?.id ?? '');
  const [kind, setKind] = React.useState<HealthEventKind>('vaccination');
  const [occurredOn, setOccurredOn] = React.useState<string>(today);
  const [diagnosis, setDiagnosis] = React.useState<string>('');
  const [medication, setMedication] = React.useState<string>('');
  const [dosage, setDosage] = React.useState<string>('');
  const [vetName, setVetName] = React.useState<string>('');
  const [cost, setCost] = React.useState<string>('');
  const [withdrawal, setWithdrawal] = React.useState<string>('');
  const [nextDue, setNextDue] = React.useState<string>('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const photoRequired = PHOTO_REQUIRED.includes(kind);

  async function submit() {
    setErr(null);
    if (!animalId || !occurredOn) {
      setErr('سب خانے پُر کریں / Fill required fields');
      return;
    }
    if (photoRequired && photos.length === 0) {
      setErr('تصویری ثبوت لازمی / Photo evidence required');
      return;
    }
    setBusy(true);
    const res = await logHealthEvent({
      animalId,
      eventKind: kind,
      occurredOn,
      diagnosis: diagnosis || undefined,
      medication: medication || undefined,
      dosage: dosage || undefined,
      vetName: vetName || undefined,
      costPkr: cost ? Number(cost) : undefined,
      withdrawalPeriodDays: withdrawal ? Number(withdrawal) : undefined,
      nextDueOn: nextDue || undefined,
      photoUrls: photos,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Error');
      return;
    }
    setOpen(false);
    location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">صحت / Health</h2>
          <p className="text-sm text-[var(--muted)]">{events.length} events · {upcoming.length} upcoming vaccinations</p>
        </div>
        <BigButton tone="primary" label="نیا اندراج / New event" sublabel="ایک ٹیپ / One tap" onClick={() => setOpen(true)} />
      </div>

      {upcoming.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">آنے والی ویکسینیشن / Upcoming (next 14d)</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {upcoming.map((u) => (
              <li key={u.id} className="rounded-md border border-amber-500/40 p-2 text-amber-700">
                <div className="font-medium">{u.earTag} · {u.eventKind}</div>
                <div className="text-xs">due {u.nextDueOn}</div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="p-2 text-left">تاریخ / Date</th>
              <th className="p-2 text-left">جانور / Animal</th>
              <th className="p-2 text-left">قسم / Kind</th>
              <th className="p-2 text-left">تشخیص / Diagnosis</th>
              <th className="p-2 text-left">دوا / Medication</th>
              <th className="p-2 text-left">ویٹ / Vet</th>
              <th className="p-2 text-right">لاگت / Cost</th>
              <th className="p-2 text-left">آئندہ / Next due</th>
              <th className="p-2 text-left">تصویر / Photo</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-[var(--muted)]">No health events.</td></tr>
            ) : events.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)]">
                <td className="p-2 whitespace-nowrap">{e.occurredOn}</td>
                <td className="p-2">{e.earTag}</td>
                <td className="p-2">{e.eventKind}</td>
                <td className="p-2">{e.diagnosis ?? '—'}</td>
                <td className="p-2">{e.medication ?? '—'}{e.dosage ? ` · ${e.dosage}` : ''}</td>
                <td className="p-2">{e.vetName ?? '—'}</td>
                <td className="p-2 text-right">{e.costPkr != null ? <Pkr value={e.costPkr} /> : '—'}</td>
                <td className="p-2 whitespace-nowrap">{e.nextDueOn ?? '—'}</td>
                <td className="p-2">{e.photoUrls.length > 0 ? `${e.photoUrls.length} 📷` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">صحت کا اندراج / Health event</h3>

            <label className="block text-sm">
              <span className="block mb-1">جانور / Animal</span>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {animalsList.map((a) => <option key={a.id} value={a.id}>{a.earTag} ({a.species})</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">قسم / Kind</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as HealthEventKind)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="block mb-1">تاریخ / Date</span>
                <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
              </label>
            </div>

            <label className="block text-sm">
              <span className="block mb-1">تشخیص / Diagnosis</span>
              <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">دوا / Medication</span>
                <Input value={medication} onChange={(e) => setMedication(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">خوراک / Dosage</span>
                <Input value={dosage} onChange={(e) => setDosage(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">ویٹ / Vet</span>
                <Input value={vetName} onChange={(e) => setVetName(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">لاگت / Cost (PKR)</span>
                <Input type="number" inputMode="decimal" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">انتظار (دن) / Withdrawal (d)</span>
                <Input type="number" inputMode="numeric" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">آئندہ / Next due</span>
                <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
              </label>
            </div>

            <PhotoUploader
              label={photoRequired ? 'تصویری ثبوت لازمی / Photo evidence (required)' : 'تصویر (اختیاری) / Photo (optional)'}
              required={photoRequired}
              value={photos}
              onChange={setPhotos}
              uploadFn={async (file) => {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
                const json = await res.json();
                return json.url as string;
              }}
            />

            {err ? <div className="text-sm text-red-500">{err}</div> : null}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy} className="flex-1">{busy ? '…' : 'محفوظ / Save'}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>منسوخ / Cancel</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
