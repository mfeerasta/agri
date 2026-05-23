'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { createSchemeApplication } from '@/modules/compliance/document-actions';

interface Props {
  schemeId: string;
  entities: Array<{ id: string; name: string }>;
}

export function ApplyForm({ schemeId, entities }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    entityId: entities[0]?.id ?? '',
    appliedOn: '',
    referenceNumber: '',
    applicantName: '',
    expectedBenefitPkr: '',
    notes: '',
  });

  function submit() {
    setError(null);
    if (!form.entityId) {
      setError('Pick an entity');
      return;
    }
    startTransition(async () => {
      const res = await createSchemeApplication({
        schemeId,
        entityId: form.entityId,
        appliedOn: form.appliedOn || undefined,
        referenceNumber: form.referenceNumber || undefined,
        applicantName: form.applicantName || undefined,
        expectedBenefitPkr: form.expectedBenefitPkr || undefined,
        notes: form.notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/compliance/schemes');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="block">
          <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">Entity</div>
          <select
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
            value={form.entityId}
            onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">Applicant name</div>
          <input
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
            value={form.applicantName}
            onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">Applied on</div>
            <input
              type="date"
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.appliedOn}
              onChange={(e) => setForm((f) => ({ ...f, appliedOn: e.target.value }))}
            />
          </label>
          <label className="block">
            <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">Reference number</div>
            <input
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.referenceNumber}
              onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
            />
          </label>
        </div>
        <label className="block">
          <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">
            Expected benefit (PKR)
          </div>
          <input
            type="number"
            step="0.01"
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
            value={form.expectedBenefitPkr}
            onChange={(e) => setForm((f) => ({ ...f, expectedBenefitPkr: e.target.value }))}
          />
        </label>
        <label className="block">
          <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">Notes</div>
          <textarea
            rows={3}
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
        <div className="text-xs text-[var(--ink)]/60">
          Status starts as <span className="font-mono">planning</span>. Walk it through to{' '}
          <span className="font-mono">submitted</span> →{' '}
          <span className="font-mono">approved</span> →{' '}
          <span className="font-mono">disbursed</span> from the schemes list.
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save as planning'}
        </button>
      </CardContent>
    </Card>
  );
}
