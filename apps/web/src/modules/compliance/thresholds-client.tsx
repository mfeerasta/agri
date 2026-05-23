'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from '@zameen/ui';
import { upsertThreshold } from './scouting-actions';

interface Threshold {
  id: string;
  entityId: string | null;
  cropCode: string;
  pestOrDisease: string;
  thresholdSeverity: number | null;
  thresholdPrevalencePct: string | null;
  recommendedResponse: string;
  ipmNotes: string | null;
  source: string | null;
}

export function ThresholdsClient({ rows }: { rows: Threshold[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Partial<Threshold> & { scope: 'entity' | 'global' } | null>(null);

  function startNew() {
    setEditing({ id: undefined, cropCode: '', pestOrDisease: '', recommendedResponse: '', scope: 'entity' });
  }

  function edit(r: Threshold) {
    setEditing({ ...r, scope: r.entityId ? 'entity' : 'global' });
  }

  function save() {
    if (!editing) return;
    if (!editing.cropCode || !editing.pestOrDisease || !editing.recommendedResponse) return;
    start(async () => {
      await upsertThreshold({
        id: editing.id,
        cropCode: editing.cropCode!,
        pestOrDisease: editing.pestOrDisease!,
        thresholdSeverity: editing.thresholdSeverity ?? undefined,
        thresholdPrevalencePct: editing.thresholdPrevalencePct ? Number(editing.thresholdPrevalencePct) : undefined,
        recommendedResponse: editing.recommendedResponse!,
        ipmNotes: editing.ipmNotes ?? undefined,
        scope: editing.scope,
      });
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Button onClick={startNew}>New threshold</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Action thresholds</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Scope</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Crop</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pest/Disease</th>
              <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Sev ≥</th>
              <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Prev ≥</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Recommendation</th>
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--rule)] align-top">
                  <td className="px-3 py-2 text-xs">{r.entityId ? 'Entity' : 'Global'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.cropCode}</td>
                  <td className="px-3 py-2 text-xs">{r.pestOrDisease}</td>
                  <td className="px-3 py-2 text-right tabular text-xs">{r.thresholdSeverity ?? ''}</td>
                  <td className="px-3 py-2 text-right tabular text-xs">{r.thresholdPrevalencePct ?? ''}</td>
                  <td className="px-3 py-2 text-xs">{r.recommendedResponse}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => edit(r)} className="text-xs underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>{editing.id ? 'Edit threshold' : 'New threshold'}</CardTitle></CardHeader>
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="smallcaps text-[0.65rem] mb-1">Crop code</div>
                <Input value={editing.cropCode ?? ''} onChange={(e) => setEditing({ ...editing, cropCode: e.target.value.toLowerCase() })} />
              </label>
              <label className="text-sm">
                <div className="smallcaps text-[0.65rem] mb-1">Pest/disease</div>
                <Input value={editing.pestOrDisease ?? ''} onChange={(e) => setEditing({ ...editing, pestOrDisease: e.target.value.toLowerCase().replace(/\s+/g, '_') })} />
              </label>
              <label className="text-sm">
                <div className="smallcaps text-[0.65rem] mb-1">Severity threshold (1 to 5)</div>
                <Input type="number" min={1} max={5} value={editing.thresholdSeverity ?? ''} onChange={(e) => setEditing({ ...editing, thresholdSeverity: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label className="text-sm">
                <div className="smallcaps text-[0.65rem] mb-1">Prevalence threshold %</div>
                <Input type="number" step="0.1" value={editing.thresholdPrevalencePct ?? ''} onChange={(e) => setEditing({ ...editing, thresholdPrevalencePct: e.target.value || null })} />
              </label>
            </div>
            <label className="block text-sm">
              <div className="smallcaps text-[0.65rem] mb-1">Recommended response</div>
              <textarea className="w-full border border-[var(--rule)] p-2" rows={3} value={editing.recommendedResponse ?? ''} onChange={(e) => setEditing({ ...editing, recommendedResponse: e.target.value })} />
            </label>
            <label className="block text-sm">
              <div className="smallcaps text-[0.65rem] mb-1">IPM notes</div>
              <textarea className="w-full border border-[var(--rule)] p-2" rows={2} value={editing.ipmNotes ?? ''} onChange={(e) => setEditing({ ...editing, ipmNotes: e.target.value })} />
            </label>
            <label className="block text-sm">
              <div className="smallcaps text-[0.65rem] mb-1">Scope</div>
              <select className="border border-[var(--rule)] p-2" value={editing.scope} onChange={(e) => setEditing({ ...editing, scope: e.target.value as 'entity' | 'global' })}>
                <option value="entity">This entity only</option>
                <option value="global">Global default</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
