'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSoilHealthCard } from './actions';

interface FieldOption {
  id: string;
  code: string;
  name: string | null;
}

interface SoilExtract {
  cardNumber: string | null;
  issuedOn: string | null;
  laboratory: string | null;
  compositeSampleCount: number | null;
  ph: number | null;
  electricalConductivityDsPerM: number | null;
  organicMatterPct: number | null;
  organicCarbonPct: number | null;
  cecCmolPerKg: number | null;
  nitrogenTotalPct: number | null;
  phosphorusAvailPpm: number | null;
  potassiumAvailPpm: number | null;
  sulphurPpm: number | null;
  zincPpm: number | null;
  ironPpm: number | null;
  manganesePpm: number | null;
  copperPpm: number | null;
  boronPpm: number | null;
  textureClass: string | null;
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
  bulkDensityGPerCm3: number | null;
  infiltrationRateCmPerHr: number | null;
  carbonatePct: number | null;
  salinityClass: string | null;
  sodicityClass: string | null;
  confidence: number;
}

export function UploadResultsForm({ fieldOptions }: { fieldOptions: FieldOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldId, setFieldId] = useState(fieldOptions[0]?.id ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [extract, setExtract] = useState<SoilExtract | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExtract() {
    setError(null);
    if (!imageUrl) {
      setError('Provide an image URL of the lab report');
      return;
    }
    try {
      const res = await fetch('/api/ocr/soil-lab', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) {
        setError(`OCR failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as SoilExtract;
      setExtract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function setField<K extends keyof SoilExtract>(key: K, value: SoilExtract[K]) {
    setExtract((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function save() {
    if (!extract) return;
    if (!fieldId) {
      setError('Pick a field');
      return;
    }
    const issued = extract.issuedOn ?? new Date().toISOString().slice(0, 10);
    const validUntil = new Date(new Date(issued).getTime() + 3 * 365 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    start(async () => {
      try {
        await createSoilHealthCard({
          fieldId,
          cardNumber: extract.cardNumber ?? `DRAFT-${Date.now()}`,
          issuedOn: issued,
          validUntil,
          laboratory: extract.laboratory ?? undefined,
          compositeSampleCount: extract.compositeSampleCount ?? undefined,
          ph: extract.ph ?? undefined,
          electricalConductivityDsPerM: extract.electricalConductivityDsPerM ?? undefined,
          organicMatterPct: extract.organicMatterPct ?? undefined,
          organicCarbonPct: extract.organicCarbonPct ?? undefined,
          cecCmolPerKg: extract.cecCmolPerKg ?? undefined,
          nitrogenTotalPct: extract.nitrogenTotalPct ?? undefined,
          phosphorusAvailPpm: extract.phosphorusAvailPpm ?? undefined,
          potassiumAvailPpm: extract.potassiumAvailPpm ?? undefined,
          sulphurPpm: extract.sulphurPpm ?? undefined,
          zincPpm: extract.zincPpm ?? undefined,
          ironPpm: extract.ironPpm ?? undefined,
          manganesePpm: extract.manganesePpm ?? undefined,
          copperPpm: extract.copperPpm ?? undefined,
          boronPpm: extract.boronPpm ?? undefined,
          textureClass: (extract.textureClass ?? undefined) as never,
          clayPct: extract.clayPct ?? undefined,
          sandPct: extract.sandPct ?? undefined,
          siltPct: extract.siltPct ?? undefined,
          bulkDensityGPerCm3: extract.bulkDensityGPerCm3 ?? undefined,
          infiltrationRateCmPerHr: extract.infiltrationRateCmPerHr ?? undefined,
          carbonatePct: extract.carbonatePct ?? undefined,
          salinityClass: (extract.salinityClass ?? undefined) as never,
          sodicityClass: (extract.sodicityClass ?? undefined) as never,
          fullReportUrl: imageUrl,
        });
        router.push(`/fields/${fieldId}/soil`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const numericKeys: Array<{ key: keyof SoilExtract; label: string }> = [
    { key: 'ph', label: 'pH' },
    { key: 'electricalConductivityDsPerM', label: 'EC (dS/m)' },
    { key: 'organicMatterPct', label: 'Organic matter %' },
    { key: 'organicCarbonPct', label: 'Organic carbon %' },
    { key: 'cecCmolPerKg', label: 'CEC (cmol/kg)' },
    { key: 'nitrogenTotalPct', label: 'N total %' },
    { key: 'phosphorusAvailPpm', label: 'P avail (ppm)' },
    { key: 'potassiumAvailPpm', label: 'K avail (ppm)' },
    { key: 'sulphurPpm', label: 'S (ppm)' },
    { key: 'zincPpm', label: 'Zn (ppm)' },
    { key: 'ironPpm', label: 'Fe (ppm)' },
    { key: 'manganesePpm', label: 'Mn (ppm)' },
    { key: 'copperPpm', label: 'Cu (ppm)' },
    { key: 'boronPpm', label: 'B (ppm)' },
    { key: 'clayPct', label: 'Clay %' },
    { key: 'sandPct', label: 'Sand %' },
    { key: 'siltPct', label: 'Silt %' },
    { key: 'bulkDensityGPerCm3', label: 'Bulk density (g/cm3)' },
    { key: 'infiltrationRateCmPerHr', label: 'Infiltration (cm/hr)' },
    { key: 'carbonatePct', label: 'Carbonate %' },
    { key: 'compositeSampleCount', label: 'Composite sample count' },
  ];

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <div className="text-xs uppercase text-slate-500">Field</div>
        <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="mt-1 w-full rounded border px-2 py-1">
          {fieldOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code} {f.name ? `· ${f.name}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <div className="text-xs uppercase text-slate-500">Lab report image URL</div>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
          placeholder="https://..."
        />
      </label>

      <button
        type="button"
        onClick={runExtract}
        className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
      >
        Extract with AI
      </button>

      {extract ? (
        <div className="space-y-3 rounded-md border border-amber-400 bg-amber-50 p-3">
          <div className="text-sm text-amber-900">
            Draft extracted (confidence {Math.round(extract.confidence * 100)}%). Review and edit before saving.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Card number</div>
              <input
                type="text"
                value={extract.cardNumber ?? ''}
                onChange={(e) => setField('cardNumber', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Issued on</div>
              <input
                type="date"
                value={extract.issuedOn ?? ''}
                onChange={(e) => setField('issuedOn', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Laboratory</div>
              <input
                type="text"
                value={extract.laboratory ?? ''}
                onChange={(e) => setField('laboratory', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Texture class</div>
              <input
                type="text"
                value={extract.textureClass ?? ''}
                onChange={(e) => setField('textureClass', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            {numericKeys.map(({ key, label }) => (
              <label key={String(key)} className="text-sm">
                <div className="text-xs uppercase text-slate-500">{label}</div>
                <input
                  type="number"
                  step="0.01"
                  value={(extract[key] as number | null) ?? ''}
                  onChange={(e) =>
                    setField(key, (e.target.value === '' ? null : Number(e.target.value)) as never)
                  }
                  className="mt-1 w-full rounded border px-2 py-1"
                />
              </label>
            ))}
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Salinity class</div>
              <input
                type="text"
                value={extract.salinityClass ?? ''}
                onChange={(e) => setField('salinityClass', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs uppercase text-slate-500">Sodicity class</div>
              <input
                type="text"
                value={extract.sodicityClass ?? ''}
                onChange={(e) => setField('sodicityClass', e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? 'Saving...' : 'Save draft card'}
          </button>
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
