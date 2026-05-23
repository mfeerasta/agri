'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, PhotoUploader } from '@zameen/ui';
import { signInVisitor } from '../actions';

const PURPOSES = [
  ['inspection', 'Inspection'],
  ['vendor_meeting', 'Vendor meeting'],
  ['vendor_delivery', 'Vendor delivery'],
  ['vet_visit', 'Vet visit'],
  ['buyer', 'Buyer'],
  ['contractor', 'Contractor'],
  ['researcher', 'Researcher'],
  ['training', 'Training'],
  ['tour', 'Tour'],
  ['government', 'Government'],
  ['family', 'Family'],
  ['other', 'Other'],
] as const;

export default function NewVisitorPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [purpose, setPurpose] = useState<string>('inspection');
  const [livestock, setLivestock] = useState(false);
  const [health, setHealth] = useState(false);
  const [photoIdUrl, setPhotoIdUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  function submit() {
    setError(null);
    setWarnings([]);
    if (!name.trim()) {
      setError('Visitor name required');
      return;
    }
    if (!health) {
      setError('Health declaration must be signed before entry');
      return;
    }
    start(async () => {
      const res = await signInVisitor({
        visitorName: name,
        cnic: cnic || undefined,
        phone: phone || undefined,
        organization: org || undefined,
        vehicleRegistration: vehicle || undefined,
        visitPurpose: purpose,
        livestockAreasVisited: livestock,
        photoIdUrl,
        healthDeclarationSigned: health,
        notes: notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.biosecurityCheckPassed) {
        setWarnings(res.failures);
      }
      router.push('/gate');
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <h1 className="text-xl font-semibold">Sign in visitor</h1>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input className="w-full rounded border p-2" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded border p-2" placeholder="CNIC" value={cnic} onChange={(e) => setCnic(e.target.value)} />
            <input className="rounded border p-2" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <input className="w-full rounded border p-2" placeholder="Organization" value={org} onChange={(e) => setOrg(e.target.value)} />
          <input
            className="w-full rounded border p-2"
            placeholder="Vehicle registration"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          />
          <div>
            <div className="text-sm text-slate-600">Photo ID</div>
            <PhotoUploader onUploaded={(url) => setPhotoIdUrl(url)} bucket="visitor-ids" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Visit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full rounded border p-2" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={livestock} onChange={(e) => setLivestock(e.target.checked)} />
            Visiting livestock areas
          </label>
          <textarea
            className="w-full rounded border p-2"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Biosecurity</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} className="mt-1" />
            <span>
              I declare I am in good health, have not visited another livestock farm in the last 48 hours, and will comply with all
              posted biosecurity rules.
            </span>
          </label>
        </CardContent>
      </Card>

      {error && <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {warnings.length > 0 && (
        <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
          Visit recorded with biosecurity failures: {warnings.join('; ')}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-3 text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Sign in'}
      </button>
    </main>
  );
}
