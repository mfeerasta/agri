'use client';
import * as React from 'react';
import { Card, CardContent } from '@zameen/ui';

interface FieldOption { id: string; label: string }

interface ThresholdHit {
  recommendedResponse: string;
  ipmNotes: string | null;
  suggestedInputName: string | null;
}

const COMMON_PESTS = [
  'yellow_rust', 'leaf_rust', 'aphid', 'armyworm', 'fall_armyworm',
  'stem_borer', 'whitefly', 'pink_bollworm', 'brown_plant_hopper',
  'jassid', 'thrips', 'mealybug', 'powdery_mildew', 'blast',
];

export default function FieldScoutingPage() {
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [fieldId, setFieldId] = React.useState('');
  const [pest, setPest] = React.useState('');
  const [severity, setSeverity] = React.useState(2);
  const [prevalence, setPrevalence] = React.useState('');
  const [sampleCount, setSampleCount] = React.useState(20);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ thresholdHit: ThresholdHit | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [gps, setGps] = React.useState<{ lat: number; lng: number } | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    fetch('/api/fields/options')
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((d) => setFields(d.options ?? []))
      .catch(() => {});
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 6000 },
      );
    }
  }, []);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/uploads/r2-presign', { method: 'POST', body: fd });
    if (!res.ok) { setError('Photo upload failed'); return; }
    const { url } = await res.json();
    setPhotos((p) => [...p, url]);
  }

  async function submit() {
    setError(null);
    if (!fieldId) return setError('Field required');
    if (!pest) return setError('Pest required');
    if (photos.length === 0) return setError('At least one photo');
    setSubmitting(true);
    const res = await fetch('/api/scouting', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fieldId,
        pestOrDisease: pest,
        severity,
        prevalencePct: prevalence ? Number(prevalence) : undefined,
        sampleCount,
        scoutMethod: 'w_pattern',
        photoUrls: photos,
        notes: notes || undefined,
        gpsLocation: gps ?? undefined,
        observedAtIso: new Date().toISOString(),
      }),
    });
    setSubmitting(false);
    if (!res.ok) { setError('Save failed'); return; }
    const data = await res.json();
    setResult({ thresholdHit: data.thresholdHit });
  }

  if (result) {
    const hit = result.thresholdHit;
    return (
      <main className="mx-auto max-w-md p-4 space-y-3">
        <Card><CardContent className="p-4 space-y-2">
          <h2 className="text-lg font-bold">Saved</h2>
          {hit ? (
            <>
              <p className="text-amber-700"><strong>Threshold exceeded.</strong></p>
              <p className="text-sm">{hit.recommendedResponse}</p>
              {hit.ipmNotes ? <p className="text-xs text-[var(--ink)]/70">IPM: {hit.ipmNotes}</p> : null}
              {hit.suggestedInputName ? <p className="text-sm text-emerald-700">Inventory: {hit.suggestedInputName}</p> : null}
            </>
          ) : <p className="text-sm">No threshold exceeded. Continue monitoring.</p>}
          <a href="/" className="block mt-4 px-4 py-3 bg-[var(--ink)] text-[var(--paper)] text-center">Home</a>
        </CardContent></Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="text-lg font-bold">Scouting</h1>
      {error ? <div className="border border-red-500 p-2 text-sm text-red-700">{error}</div> : null}
      <select className="w-full border p-3" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
        <option value="">Pick field</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      <select className="w-full border p-3" value={pest} onChange={(e) => setPest(e.target.value)}>
        <option value="">Pick pest/disease</option>
        {COMMON_PESTS.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
      </select>
      <div>
        <label className="text-sm">Severity: <strong>{severity}</strong></label>
        <input type="range" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="w-full" />
      </div>
      <input type="number" placeholder="Prevalence %" className="w-full border p-3" value={prevalence} onChange={(e) => setPrevalence(e.target.value)} />
      <input type="number" placeholder="Sample count" className="w-full border p-3" value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value))} />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
      <button type="button" onClick={() => fileRef.current?.click()} className="w-full px-4 py-3 border border-[var(--rule)]">
        Add photo ({photos.length})
      </button>
      <textarea placeholder="Notes" className="w-full border p-3" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button onClick={submit} disabled={submitting} className="w-full px-4 py-4 bg-[var(--ink)] text-[var(--paper)]">
        {submitting ? 'Saving…' : 'Save observation'}
      </button>
    </main>
  );
}
