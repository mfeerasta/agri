'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { FeasibilityDraft } from '@zameen/shared';
import { createFeasibilityStudy, submitFeasibilityForApproval } from '@/modules/feasibilities/actions';

interface FormState {
  title: string;
  type: string;
  briefDescription: string;
  capexEstimatePkr: string;
  opexEstimatePkr: string;
  draft: FeasibilityDraft | null;
  loadingDraft: boolean;
  submitting: boolean;
  error: string | null;
  entityId: string;
}

export function NewFeasibilityForm({ entityId = '' }: { entityId?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    title: '',
    type: 'crop_diversification',
    briefDescription: '',
    capexEstimatePkr: '',
    opexEstimatePkr: '',
    draft: null,
    loadingDraft: false,
    submitting: false,
    error: null,
    entityId,
  });

  async function generateDraft() {
    setState((s) => ({ ...s, loadingDraft: true, error: null }));
    try {
      const res = await fetch('/api/feasibility/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          type: state.type,
          briefDescription: state.briefDescription,
          capexEstimatePkr: state.capexEstimatePkr ? Number(state.capexEstimatePkr) : undefined,
          opexEstimatePkr: state.opexEstimatePkr ? Number(state.opexEstimatePkr) : undefined,
        }),
      });
      const data = (await res.json()) as { draft?: FeasibilityDraft; error?: string };
      if (!res.ok || !data.draft) throw new Error(data.error ?? 'Draft failed');
      setState((s) => ({
        ...s,
        draft: data.draft!,
        capexEstimatePkr: String(data.draft!.capexEstimatePkr ?? s.capexEstimatePkr),
        opexEstimatePkr: String(data.draft!.opexEstimatePkr ?? s.opexEstimatePkr),
        loadingDraft: false,
      }));
    } catch (e) {
      setState((s) => ({ ...s, loadingDraft: false, error: (e as Error).message }));
    }
  }

  function updateDraft<K extends keyof FeasibilityDraft>(key: K, value: FeasibilityDraft[K]) {
    setState((s) => (s.draft ? { ...s, draft: { ...s.draft, [key]: value } } : s));
  }

  async function save(thenSubmit: boolean) {
    if (!state.draft) return;
    setState((s) => ({ ...s, submitting: true, error: null }));
    const result = await createFeasibilityStudy({
      entityId: state.entityId,
      title: state.title,
      background: state.draft.background,
      scope: state.draft.scope,
      capexEstimatePkr: state.draft.capexEstimatePkr,
      opexEstimatePkr: state.draft.opexEstimatePkr,
      costBreakdown: state.draft.costBreakdown,
      revenueProjection: state.draft.revenueProjection,
      yieldAssumptions: state.draft.yieldAssumptions,
      priceAssumptions: state.draft.priceAssumptions,
      sensitivity: state.draft.sensitivity,
      riskAssessment: state.draft.riskAssessment,
      statusQuoComparison: state.draft.statusQuoComparison,
    });
    if (!result.ok) {
      setState((s) => ({ ...s, submitting: false, error: result.error }));
      return;
    }
    if (thenSubmit) {
      await submitFeasibilityForApproval(result.id);
    }
    startTransition(() => {
      router.push(`/feasibilities/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-medium">Brief for the AI</h2>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Title (e.g. Convert F2 from wheat to sugarcane)"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Type (e.g. crop_diversification, capex_purchase, livestock_expansion)"
          value={state.type}
          onChange={(e) => setState((s) => ({ ...s, type: e.target.value }))}
        />
        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder="Write a short prompt for the AI. Describe the proposal: acres, crops, equipment, expected revenue, anything else the analyst should know."
          rows={5}
          value={state.briefDescription}
          onChange={(e) => setState((s) => ({ ...s, briefDescription: e.target.value }))}
        />
        <div className="flex gap-3">
          <input
            className="rounded border px-3 py-2 flex-1"
            placeholder="Capex estimate PKR (optional)"
            value={state.capexEstimatePkr}
            onChange={(e) => setState((s) => ({ ...s, capexEstimatePkr: e.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 flex-1"
            placeholder="Opex estimate PKR (optional)"
            value={state.opexEstimatePkr}
            onChange={(e) => setState((s) => ({ ...s, opexEstimatePkr: e.target.value }))}
          />
        </div>
        <button
          onClick={generateDraft}
          disabled={state.loadingDraft || state.briefDescription.length < 20}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {state.loadingDraft ? 'Generating...' : 'Generate draft with AI'}
        </button>
        {state.error && <div className="text-sm text-red-600">{state.error}</div>}
      </section>

      {state.draft && (
        <section className="rounded border border-slate-200 bg-white p-4 space-y-4">
          <h2 className="font-medium">Edit the draft</h2>

          <label className="block text-sm">
            Background
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={5}
              value={state.draft.background}
              onChange={(e) => updateDraft('background', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Capex (PKR)
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={state.draft.capexEstimatePkr}
                onChange={(e) => updateDraft('capexEstimatePkr', Number(e.target.value))}
              />
            </label>
            <label className="block text-sm">
              Opex (PKR)
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={state.draft.opexEstimatePkr}
                onChange={(e) => updateDraft('opexEstimatePkr', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="text-xs text-slate-500">
            Risks, scope, sensitivity, cost breakdown, and revenue projection are stored as drafted. Edit them on
            the detail page after save if needed.
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => save(false)}
              disabled={state.submitting}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm"
            >
              Save draft
            </button>
            <button
              onClick={() => save(true)}
              disabled={state.submitting}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save and submit for Director approval
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
