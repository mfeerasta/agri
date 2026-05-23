'use client';
import * as React from 'react';
import { BigButton, Card, Button, Input, Pkr } from '@zameen/ui';
import { logBreedingEvent, updateBreedingEvent, type BreedingEventRow, type BreedingOutcome } from '../breeding-actions';

export interface BreedingBoardProps {
  events: BreedingEventRow[];
  females: Array<{ id: string; earTag: string; species: string }>;
  males: Array<{ id: string; earTag: string; species: string }>;
}

const OUTCOMES: BreedingOutcome[] = ['pending', 'pregnant', 'aborted', 'calved', 'failed'];

export function BreedingBoard({ events, females, males }: BreedingBoardProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const [femaleId, setFemaleId] = React.useState<string>(females[0]?.id ?? '');
  const [maleId, setMaleId] = React.useState<string>('');
  const [semenSource, setSemenSource] = React.useState<string>('');
  const [bredOn, setBredOn] = React.useState<string>(today);
  const [vetName, setVetName] = React.useState<string>('');
  const [cost, setCost] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!femaleId || !bredOn) {
      setErr('سب خانے پُر کریں / Fill required fields');
      return;
    }
    setBusy(true);
    const res = await logBreedingEvent({
      femaleAnimalId: femaleId,
      maleAnimalId: maleId || undefined,
      semenSource: semenSource || undefined,
      bredOn,
      vetName: vetName || undefined,
      costPkr: cost ? Number(cost) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Error');
      return;
    }
    setOpen(false);
    location.reload();
  }

  async function setOutcome(id: string, outcome: BreedingOutcome) {
    const res = await updateBreedingEvent({ id, outcome, actualCalvingDate: outcome === 'calved' ? today : undefined });
    if (res.ok) location.reload();
  }

  const upcoming = events
    .filter((e) => e.expectedCalvingDate && (e.outcome === 'pending' || e.outcome === 'pregnant'))
    .sort((a, b) => (a.expectedCalvingDate ?? '').localeCompare(b.expectedCalvingDate ?? ''))
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">افزائش نسل / Breeding</h2>
          <p className="text-sm text-[var(--muted)]">{events.length} cycles · {upcoming.length} upcoming calvings</p>
        </div>
        <BigButton tone="primary" label="نیا اندراج / New breeding" sublabel="ایک ٹیپ / One tap" onClick={() => setOpen(true)} />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">متوقع زچگی کیلنڈر / Expected calving calendar</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No upcoming calvings.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {upcoming.map((e) => {
              const days = Math.round((new Date(e.expectedCalvingDate!).getTime() - Date.now()) / 86_400_000);
              const tone = days < 7 ? 'text-red-600 border-red-500/40' : days < 30 ? 'text-amber-600 border-amber-500/40' : 'text-[var(--muted)] border-[var(--border)]';
              return (
                <li key={e.id} className={`rounded-md border p-2 ${tone}`}>
                  <div className="font-medium">{e.femaleEarTag} ({e.femaleSpecies})</div>
                  <div className="text-xs">due {e.expectedCalvingDate} · in {days}d</div>
                  <div className="text-xs">bred {e.bredOn}{e.maleEarTag ? ` · ♂ ${e.maleEarTag}` : ''}</div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="p-2 text-left">مادہ / Female</th>
              <th className="p-2 text-left">نر / Male</th>
              <th className="p-2 text-left">نسلی ماخذ / Semen src</th>
              <th className="p-2 text-left">جوڑا / Bred</th>
              <th className="p-2 text-left">متوقع / Due</th>
              <th className="p-2 text-left">نتیجہ / Outcome</th>
              <th className="p-2 text-right">لاگت / Cost</th>
              <th className="p-2 text-left">عمل / Action</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-[var(--muted)]">No breeding events.</td></tr>
            ) : events.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)]">
                <td className="p-2">{e.femaleEarTag}</td>
                <td className="p-2">{e.maleEarTag ?? '—'}</td>
                <td className="p-2">{e.semenSource ?? '—'}</td>
                <td className="p-2 whitespace-nowrap">{e.bredOn}</td>
                <td className="p-2 whitespace-nowrap">{e.expectedCalvingDate ?? '—'}</td>
                <td className="p-2">{e.outcome ?? '—'}</td>
                <td className="p-2 text-right">{e.costPkr != null ? <Pkr value={e.costPkr} /> : '—'}</td>
                <td className="p-2">
                  <select
                    value={e.outcome ?? 'pending'}
                    onChange={(ev) => setOutcome(e.id, ev.target.value as BreedingOutcome)}
                    className="rounded border border-[var(--border)] bg-[var(--surface)] p-1 text-xs"
                  >
                    {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">نیا افزائش اندراج / Log breeding</h3>

            <label className="block text-sm">
              <span className="block mb-1">مادہ / Female</span>
              <select value={femaleId} onChange={(e) => setFemaleId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {females.map((f) => <option key={f.id} value={f.id}>{f.earTag} ({f.species})</option>)}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">نر (اختیاری) / Male (optional)</span>
              <select value={maleId} onChange={(e) => setMaleId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                <option value="">— AI / external —</option>
                {males.map((m) => <option key={m.id} value={m.id}>{m.earTag} ({m.species})</option>)}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">نسلی ماخذ / Semen source</span>
              <Input value={semenSource} onChange={(e) => setSemenSource(e.target.value)} placeholder="e.g. Sahiwal AI Centre" />
            </label>

            <label className="block text-sm">
              <span className="block mb-1">جوڑا تاریخ / Bred on</span>
              <Input type="date" value={bredOn} onChange={(e) => setBredOn(e.target.value)} />
            </label>

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
