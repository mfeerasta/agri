'use client';
import * as React from 'react';
import { KanbanBoard } from '@zameen/ui';
import { updateOpportunityStage } from '@/modules/sales/crm-actions';

export interface OppItem {
  id: string;
  buyerId: string | null;
  buyerName: string | null;
  buyerNameFreeform: string | null;
  cropCode: string;
  estimatedKg: number;
  targetPricePerKgPkr: number | null;
  stage: string;
  winProbabilityPct: number | null;
  expectedCloseDate: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  negotiating: 'Negotiating',
  contracted: 'Contracted',
  delivered: 'Delivered',
  lost: 'Lost',
};

export function PipelineBoardClient({ items, stages }: { items: OppItem[]; stages: string[] }) {
  const [local, setLocal] = React.useState(items);
  React.useEffect(() => setLocal(items), [items]);

  async function onMove(itemId: string, _from: string, to: string) {
    setLocal((prev) => prev.map((i) => (i.id === itemId ? { ...i, stage: to } : i)));
    let lostReason: string | undefined;
    if (to === 'lost') {
      lostReason = typeof window !== 'undefined' ? window.prompt('Reason for loss?') ?? undefined : undefined;
    }
    const res = await updateOpportunityStage({ id: itemId, stage: to, lostReason });
    if (!res.ok && typeof window !== 'undefined') window.alert(res.error);
  }

  return (
    <KanbanBoard
      groups={stages.map((s) => ({ id: s, label: STAGE_LABELS[s] ?? s }))}
      items={local}
      getId={(i) => i.id}
      getGroup={(i) => i.stage}
      onMove={onMove}
      renderCard={(i) => (
        <div className="rounded border border-[var(--rule)] bg-[var(--paper)] p-2 text-xs cursor-grab">
          <div className="font-medium">{i.buyerName ?? i.buyerNameFreeform ?? 'Unnamed buyer'}</div>
          <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">{i.cropCode}</div>
          <div className="tabular mt-1">{i.estimatedKg.toLocaleString()} kg</div>
          {i.targetPricePerKgPkr ? (
            <div className="tabular text-[var(--ink)]/70">@ PKR {i.targetPricePerKgPkr.toLocaleString()}/kg</div>
          ) : null}
          {i.winProbabilityPct != null ? (
            <div className="text-[var(--ink)]/60">{i.winProbabilityPct}% win</div>
          ) : null}
          {i.expectedCloseDate ? (
            <div className="text-[var(--ink)]/60">close {i.expectedCloseDate}</div>
          ) : null}
        </div>
      )}
    />
  );
}
