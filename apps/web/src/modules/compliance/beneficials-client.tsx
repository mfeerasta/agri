'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, PhotoUploader } from '@zameen/ui';
import { logBeneficialInsect } from './scouting-actions';

const SPECIES = [
  'Lady beetle (Coccinellidae)',
  'Lacewing (Chrysoperla)',
  'Spider',
  'Trichogramma',
  'Hoverfly larvae',
  'Praying mantis',
  'Encarsia formosa',
  'Ground beetle (Carabidae)',
  'Parasitoid wasp',
  'Earthworm',
];

export function BeneficialsClient({ fieldOptions }: { fieldOptions: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldId, setFieldId] = useState('');
  const [species, setSpecies] = useState(SPECIES[0]);
  const [count, setCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');

  function submit() {
    setError('');
    if (!fieldId) return setError('Pick a field.');
    if (!species) return setError('Pick a species.');
    start(async () => {
      const res = await logBeneficialInsect({
        fieldId,
        observedAtIso: new Date().toISOString(),
        species,
        countEstimate: count > 0 ? count : undefined,
        notes: notes || undefined,
        photoUrls: photos,
      });
      if (!res.ok) return setError(res.error);
      setCount(0); setNotes(''); setPhotos([]);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Log beneficial insects</CardTitle></CardHeader>
      <CardContent className="p-3 space-y-3">
        {error ? <div className="border border-red-500 p-2 text-sm text-red-700">{error}</div> : null}
        <label className="block text-sm">
          <div className="smallcaps text-[0.65rem] mb-1">Field</div>
          <select className="w-full border border-[var(--rule)] p-2" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            <option value="">Select field</option>
            {fieldOptions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <div className="smallcaps text-[0.65rem] mb-1">Species</div>
          <select className="w-full border border-[var(--rule)] p-2" value={species} onChange={(e) => setSpecies(e.target.value)}>
            {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <div className="smallcaps text-[0.65rem] mb-1">Count estimate</div>
          <Input type="number" min={0} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="block text-sm">
          <div className="smallcaps text-[0.65rem] mb-1">Notes</div>
          <textarea className="w-full border border-[var(--rule)] p-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <PhotoUploader value={photos} onChange={setPhotos} maxFiles={3} />
        <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Log beneficials'}</Button>
      </CardContent>
    </Card>
  );
}
