'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, PhotoUploader, VoiceNote, Input, Button } from '@zameen/ui';
import { createScoutingObservation, type ThresholdHit } from './scouting-actions';

type ScoutMethod = 'w_pattern' | 'x_pattern' | 'random' | 'perimeter' | 'full_field';

interface Option { id: string; label: string }

interface Props {
  fieldOptions: Option[];
  cropPlanOptions: Array<{ id: string; fieldId: string; label: string }>;
  commonPests: string[];
}

const METHODS: { value: ScoutMethod; label: string }[] = [
  { value: 'w_pattern', label: 'W pattern' },
  { value: 'x_pattern', label: 'X pattern' },
  { value: 'random', label: 'Random' },
  { value: 'perimeter', label: 'Perimeter' },
  { value: 'full_field', label: 'Full field' },
];

export function ScoutingFormClient({ fieldOptions, cropPlanOptions, commonPests }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldId, setFieldId] = useState('');
  const [cropPlanId, setCropPlanId] = useState('');
  const [scoutMethod, setScoutMethod] = useState<ScoutMethod>('w_pattern');
  const [sampleCount, setSampleCount] = useState(20);
  const [pest, setPest] = useState('');
  const [severity, setSeverity] = useState(2);
  const [prevalence, setPrevalence] = useState('');
  const [growthStage, setGrowthStage] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [voiceUrl, setVoiceUrl] = useState<string | undefined>();
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [hit, setHit] = useState<ThresholdHit | null>(null);
  const [error, setError] = useState('');

  const filteredPlans = cropPlanOptions.filter((p) => !fieldId || p.fieldId === fieldId);

  function captureGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setError('Could not read GPS'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function submit() {
    setError('');
    if (!fieldId) return setError('Pick a field.');
    if (!pest) return setError('Enter a pest or disease.');
    if (photos.length === 0) return setError('At least one photo is required.');
    start(async () => {
      const res = await createScoutingObservation({
        fieldId,
        cropPlanId: cropPlanId || undefined,
        observedAtIso: new Date().toISOString(),
        scoutMethod,
        sampleCount,
        pestOrDisease: pest,
        severity,
        prevalencePct: prevalence ? Number(prevalence) : undefined,
        growthStage: growthStage || undefined,
        gpsLocation: gps ?? undefined,
        photoUrls: photos,
        voiceNoteUrl: voiceUrl,
        notes: notes || undefined,
      });
      if (!res.ok) return setError(res.error);
      setHit(res.thresholdHit);
      if (!res.thresholdHit) router.push('/compliance/scouting');
    });
  }

  return (
    <div className="space-y-4">
      {error ? <div className="border border-red-500 p-2 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardHeader><CardTitle>1. Field and method</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Field</div>
            <select className="w-full border border-[var(--rule)] p-2" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">Select field</option>
              {fieldOptions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Crop plan (optional)</div>
            <select className="w-full border border-[var(--rule)] p-2" value={cropPlanId} onChange={(e) => setCropPlanId(e.target.value)}>
              <option value="">No plan selected</option>
              {filteredPlans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <div className="flex gap-2 flex-wrap">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setScoutMethod(m.value)}
                className={`px-3 py-1 text-xs border ${scoutMethod === m.value ? 'bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule)]'}`}
              >{m.label}</button>
            ))}
          </div>
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Sample count</div>
            <Input type="number" min={1} value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value))} />
          </label>
          <div className="flex gap-2 items-center">
            <Button type="button" variant="secondary" onClick={captureGps}>Capture GPS</Button>
            {gps ? <span className="tabular text-xs">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{Math.round(gps.accuracy ?? 0)}m)</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Identify pest/disease</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Pest or disease</div>
            <Input list="common-pests" value={pest} onChange={(e) => setPest(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="e.g. yellow_rust" />
            <datalist id="common-pests">
              {commonPests.map((p) => <option key={p} value={p} />)}
            </datalist>
          </label>
          <p className="text-xs text-[var(--ink)]/60">
            Tip: upload a photo below, then visit <Link href="/diagnostics" className="underline">Diagnostics</Link> to run Claude vision and copy the suggested label back here.
          </p>
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Growth stage</div>
            <Input value={growthStage} onChange={(e) => setGrowthStage(e.target.value)} placeholder="tillering, flowering, boll formation..." />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Severity and prevalence</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Severity 1 to 5</div>
            <input type="range" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="w-full" />
            <div className="tabular text-sm mt-1">Severity: <strong>{severity}</strong></div>
          </label>
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Prevalence (% plants affected)</div>
            <Input type="number" step="0.1" value={prevalence} onChange={(e) => setPrevalence(e.target.value)} placeholder="e.g. 8.5" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Evidence</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          <PhotoUploader value={photos} onChange={setPhotos} maxFiles={5} />
          <VoiceNote value={voiceUrl} onChange={setVoiceUrl} />
          <label className="block text-sm">
            <div className="smallcaps text-[0.65rem] mb-1">Notes</div>
            <textarea className="w-full border border-[var(--rule)] p-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Save observation'}</Button>
        <Link href="/compliance/scouting" className="px-4 py-2 border border-[var(--rule)] text-sm">Cancel</Link>
      </div>

      {hit ? (
        <Card className="border-amber-500">
          <CardHeader><CardTitle>Action threshold exceeded</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-2 text-sm">
            <p><strong>Recommendation:</strong> {hit.recommendedResponse}</p>
            {hit.ipmNotes ? <p className="text-[var(--ink)]/70"><strong>IPM:</strong> {hit.ipmNotes}</p> : null}
            {hit.suggestedInputName ? (
              <p className="text-emerald-700">Inventory match: <strong>{hit.suggestedInputName}</strong></p>
            ) : <p className="text-[var(--ink)]/60">No matching pesticide found in inventory.</p>}
            <div className="flex gap-2 pt-2">
              <Link
                href={`/compliance/spray-diary/planner?fieldId=${fieldId}&pesticide=${encodeURIComponent(hit.suggestedInputName ?? '')}&fromScouting=1`}
                className="px-3 py-2 bg-[var(--ink)] text-[var(--paper)] text-sm smallcaps"
              >Open spray planner</Link>
              <Link href="/compliance/scouting" className="px-3 py-2 border border-[var(--rule)] text-sm">Back to scouting</Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
