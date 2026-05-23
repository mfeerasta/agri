'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSamplingEvent, generateGpsGrid } from './actions';

interface FieldOption {
  id: string;
  code: string;
  name: string | null;
  bbox?: [number, number, number, number] | null;
}

export function SamplingForm({ fieldOptions, initialFieldId }: { fieldOptions: FieldOption[]; initialFieldId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldId, setFieldId] = useState(initialFieldId ?? fieldOptions[0]?.id ?? '');
  const [sampledOn, setSampledOn] = useState(new Date().toISOString().slice(0, 10));
  const [samplingMethod, setSamplingMethod] = useState<
    'grid_systematic' | 'random' | 'zone_based' | 'composite_w' | 'single_point'
  >('grid_systematic');
  const [sampleCount, setSampleCount] = useState(8);
  const [depthCm, setDepthCm] = useState(15);
  const [gpsPoints, setGpsPoints] = useState<Array<{ lat: number; lng: number; label?: string }>>([]);
  const [sentToLab, setSentToLab] = useState('');
  const [labReferenceNumber, setLabReferenceNumber] = useState('');
  const [expectedResultDate, setExpectedResultDate] = useState('');
  const [costPkr, setCostPkr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function autoGenerateGrid() {
    const field = fieldOptions.find((f) => f.id === fieldId);
    if (!field?.bbox) {
      setError('No bounding box for this field. Add geometry first or enter points manually.');
      return;
    }
    setGpsPoints(generateGpsGrid(field.bbox, sampleCount));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fieldId) {
      setError('Pick a field');
      return;
    }
    if (sampleCount < 1) {
      setError('Sample count must be at least 1');
      return;
    }
    start(async () => {
      try {
        await createSamplingEvent({
          fieldId,
          sampledOn,
          samplingMethod,
          sampleCount,
          depthCm,
          gpsLocations: gpsPoints,
          sentToLab: sentToLab || undefined,
          labReferenceNumber: labReferenceNumber || undefined,
          expectedResultDate: expectedResultDate || undefined,
          costPkr: costPkr ? Number(costPkr) : undefined,
          notes: notes || undefined,
        });
        router.push('/land/soil-sampling');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Field</div>
          <select
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {fieldOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} {f.name ? `· ${f.name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Sampled on</div>
          <input
            type="date"
            value={sampledOn}
            onChange={(e) => setSampledOn(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Method</div>
          <select
            value={samplingMethod}
            onChange={(e) =>
              setSamplingMethod(e.target.value as 'grid_systematic' | 'random' | 'zone_based' | 'composite_w' | 'single_point')
            }
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="grid_systematic">Grid systematic</option>
            <option value="random">Random</option>
            <option value="zone_based">Zone based</option>
            <option value="composite_w">Composite W</option>
            <option value="single_point">Single point</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Sample count</div>
          <input
            type="number"
            min={1}
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Depth (cm)</div>
          <input
            type="number"
            min={1}
            value={depthCm}
            onChange={(e) => setDepthCm(Number(e.target.value))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Sent to lab</div>
          <input
            type="text"
            value={sentToLab}
            onChange={(e) => setSentToLab(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Lab ref number</div>
          <input
            type="text"
            value={labReferenceNumber}
            onChange={(e) => setLabReferenceNumber(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Expected result date</div>
          <input
            type="date"
            value={expectedResultDate}
            onChange={(e) => setExpectedResultDate(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Cost PKR</div>
          <input
            type="number"
            min={0}
            value={costPkr}
            onChange={(e) => setCostPkr(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>

      <div className="rounded-md border border-[var(--rule)] p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">GPS sample points ({gpsPoints.length})</h3>
          <button
            type="button"
            onClick={autoGenerateGrid}
            className="rounded-md bg-slate-700 px-3 py-1 text-sm text-white"
          >
            Auto-generate grid
          </button>
        </div>
        {gpsPoints.length > 0 ? (
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
            {gpsPoints.map((p, i) => (
              <li key={i}>
                {p.label ?? `S${i + 1}`}: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            No points yet. Click auto-generate or capture on a mobile device.
          </p>
        )}
      </div>

      <label className="block text-sm">
        <div className="text-xs uppercase text-slate-500">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
          rows={3}
        />
      </label>

      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save sampling event'}
      </button>
    </form>
  );
}
