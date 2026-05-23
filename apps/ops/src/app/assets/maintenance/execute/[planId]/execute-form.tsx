'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, PhotoUploader, PkrInput } from '@zameen/ui';
import type { MaintenancePartRequired } from '@zameen/db';
import { recordMaintenance } from '../../actions';

interface Props {
  planId: string;
  assetId: string;
  partsRequired: MaintenancePartRequired[];
}

interface PartRow {
  name: string;
  partNumber?: string;
  quantity: number;
  unitCostPkr: number;
  used: boolean;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ExecuteForm({ planId, assetId, partsRequired }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [executedOn, setExecutedOn] = useState(todayIso());
  const [hourMeter, setHourMeter] = useState<number | undefined>(undefined);
  const [laborHours, setLaborHours] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [externalCost, setExternalCost] = useState<number>(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [parts, setParts] = useState<PartRow[]>(
    partsRequired.map((p) => ({
      name: p.name,
      partNumber: p.partNumber,
      quantity: p.quantity,
      unitCostPkr: p.unitCostPkr ?? 0,
      used: true,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const partsCost = useMemo(
    () => parts.filter((p) => p.used).reduce((s, p) => s + p.quantity * p.unitCostPkr, 0),
    [parts],
  );
  const total = partsCost + laborCost + externalCost;

  function setPart(idx: number, patch: Partial<PartRow>) {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function submit() {
    setError(null);
    if (photoUrls.length === 0) {
      setError('At least one service photo required.');
      return;
    }
    start(async () => {
      const res = await recordMaintenance({
        planId,
        assetId,
        executedOn,
        hourMeterAtService: hourMeter,
        partsUsed: parts
          .filter((p) => p.used)
          .map((p) => ({
            name: p.name,
            partNumber: p.partNumber,
            quantity: p.quantity,
            unitCostPkr: p.unitCostPkr,
          })),
        laborHours,
        laborCostPkr: laborCost,
        externalServiceCostPkr: externalCost,
        notes,
        photoUrls,
      });
      if (!res.ok) setError(res.error);
      else router.push(`/assets/${assetId}/maintenance`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="smallcaps text-[var(--zameen-600)]">Date</span>
            <input
              type="date"
              value={executedOn}
              onChange={(e) => setExecutedOn(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            <span className="smallcaps text-[var(--zameen-600)]">Hour meter at service</span>
            <input
              type="number"
              step="0.1"
              value={hourMeter ?? ''}
              onChange={(e) => setHourMeter(e.target.value === '' ? undefined : Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
        </div>

        <div>
          <div className="smallcaps mb-2 text-[var(--zameen-600)]">Parts</div>
          <table className="w-full text-sm">
            <thead className="smallcaps text-[var(--zameen-600)]">
              <tr>
                <th className="px-1 py-1 text-left">Use</th>
                <th className="px-1 py-1 text-left">Part</th>
                <th className="px-1 py-1 text-right">Qty</th>
                <th className="px-1 py-1 text-right">Unit cost</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="px-1 py-1">
                    <input type="checkbox" checked={p.used} onChange={(e) => setPart(i, { used: e.target.checked })} />
                  </td>
                  <td className="px-1 py-1">{p.name}</td>
                  <td className="px-1 py-1 text-right">
                    <input
                      type="number"
                      step="0.1"
                      value={p.quantity}
                      onChange={(e) => setPart(i, { quantity: Number(e.target.value) })}
                      className="w-20 rounded border px-1 text-right"
                    />
                  </td>
                  <td className="px-1 py-1 text-right">
                    <input
                      type="number"
                      step="1"
                      value={p.unitCostPkr}
                      onChange={(e) => setPart(i, { unitCostPkr: Number(e.target.value) })}
                      className="w-24 rounded border px-1 text-right"
                    />
                  </td>
                </tr>
              ))}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-center text-[var(--zameen-600)]">
                    No parts on template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="smallcaps text-[var(--zameen-600)]">Labor hours</span>
            <input
              type="number"
              step="0.25"
              value={laborHours}
              onChange={(e) => setLaborHours(Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <PkrInput label="Labor cost (PKR)" value={laborCost} onChange={setLaborCost} />
          <PkrInput label="External service (PKR)" value={externalCost} onChange={setExternalCost} />
        </div>

        <div className="rounded bg-[var(--zameen-50)] p-3 text-sm">
          Total: <strong>PKR {total.toFixed(2)}</strong> ({partsCost.toFixed(2)} parts + {laborCost.toFixed(2)} labor +{' '}
          {externalCost.toFixed(2)} external)
        </div>

        <label className="block text-sm">
          <span className="smallcaps text-[var(--zameen-600)]">Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        <div>
          <div className="smallcaps mb-1 text-[var(--zameen-600)]">Service photo (required)</div>
          <PhotoUploader values={photoUrls} onChange={setPhotoUrls} bucket="maintenance" maxFiles={4} />
        </div>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving...' : 'Record service'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
