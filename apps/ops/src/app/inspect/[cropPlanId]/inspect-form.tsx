'use client';
import * as React from 'react';
import { BigButton, Card, CardContent, CardHeader, CardTitle, Input, Textarea, UrduInput, VoiceNote, PhotoUploader } from '@zameen/ui';
import { submitInspection } from './actions';

const STAGES = ['land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest'] as const;
const PRESSURES = ['low', 'med', 'high'] as const;

async function uploadFile(file: File): Promise<string> {
  // Reuse the existing receipts upload endpoint; if missing, server action accepts raw urls.
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  const j = (await res.json()) as { url: string };
  return j.url;
}

export function InspectForm({ cropPlanId, currentStage }: { cropPlanId: string; currentStage: string }) {
  const [stage, setStage] = React.useState<string>(currentStage);
  const [pressure, setPressure] = React.useState<'low' | 'med' | 'high'>('low');
  const [urgent, setUrgent] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [urduNotes, setUrduNotes] = React.useState('');
  const [voiceTranscript, setVoiceTranscript] = React.useState<string>('');
  const [photoUrls, setPhotoUrls] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const r = await submitInspection({
      cropPlanId,
      stage,
      notes: [notes, urduNotes ? `[UR] ${urduNotes}` : '', voiceTranscript ? `[VOICE] ${voiceTranscript}` : ''].filter(Boolean).join(' · '),
      photoUrls,
      pestPressure: pressure,
      urgentAction: urgent,
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Inspection recorded');
      setNotes('');
      setUrduNotes('');
      setPhotoUrls([]);
      setVoiceTranscript('');
    } else setMsg(r.error);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Log inspection</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">Observed stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-sm border border-[var(--rule)] bg-[var(--paper)] px-3 py-2"
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">Photos</label>
          <PhotoUploader value={photoUrls} onChange={setPhotoUrls} uploadFn={uploadFile} max={6} />
        </div>

        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations…" />
        </div>

        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">اردو نوٹس</label>
          <UrduInput value={urduNotes} onChange={(e) => setUrduNotes(e.target.value)} placeholder="اردو میں" />
        </div>

        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">Voice note</label>
          <VoiceNote onTranscript={(t) => setVoiceTranscript((v) => `${v} ${t}`.trim())} />
        </div>

        <div className="space-y-1">
          <label className="smallcaps text-[0.7rem]">Pest pressure</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESSURES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPressure(p)}
                className={`rounded-sm border px-3 py-2 text-sm uppercase tracking-wide ${
                  pressure === p ? 'border-[var(--zameen-700)] bg-[var(--zameen-700)] text-[var(--paper)]' : 'border-[var(--rule)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          Urgent action required
        </label>

        <BigButton label={busy ? 'Saving…' : 'Save inspection'} onClick={submit} disabled={busy} />
        {msg ? <p className="text-sm text-[var(--ink)]/70">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
