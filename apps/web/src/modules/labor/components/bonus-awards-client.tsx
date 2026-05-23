'use client';
import * as React from 'react';
import { Button, Card, CardContent, Input, Pkr } from '@zameen/ui';
import {
  previewBonusAwards,
  approveBonusAwards,
  type BonusAwardPreview,
} from '../bonus-actions';

export interface BonusAwardsClientProps {
  entityId: string;
  ruleSets: Array<{ id: string; name: string; isActive: boolean }>;
  recent: Array<{
    id: string;
    workerCode: string;
    workerName: string;
    periodStart: string;
    periodEnd: string;
    totalBonusPkr: number;
    approvalRequestId: string | null;
    paidInPayrollRunId: string | null;
  }>;
}

export function BonusAwardsClient({
  entityId,
  ruleSets,
  recent,
}: BonusAwardsClientProps): React.JSX.Element {
  const firstActive = ruleSets.find((r) => r.isActive)?.id ?? ruleSets[0]?.id ?? '';
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const [ruleSetId, setRuleSetId] = React.useState(firstActive);
  const [periodStart, setPeriodStart] = React.useState(monthStart);
  const [periodEnd, setPeriodEnd] = React.useState(today);
  const [preview, setPreview] = React.useState<BonusAwardPreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const onPreview = async () => {
    if (!ruleSetId) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await previewBonusAwards({ entityId, ruleSetId, periodStart, periodEnd });
      setPreview(p);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async () => {
    if (!preview) return;
    setBusy(true);
    setMsg(null);
    const res = await approveBonusAwards({
      entityId,
      ruleSetId: preview.ruleSetId,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
    });
    setBusy(false);
    if (res.ok) {
      setMsg(`Submitted ${res.awarded} awards for approval`);
      setPreview(null);
    } else {
      setMsg(res.error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Rule set</span>
              <select
                value={ruleSetId}
                onChange={(e) => setRuleSetId(e.target.value)}
                className="block w-full border border-[var(--border)] px-2 py-1.5"
              >
                {ruleSets.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isActive ? '' : '(inactive)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Period start</span>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Period end</span>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <Button type="button" onClick={onPreview} disabled={busy || !ruleSetId}>
                {busy ? 'Computing…' : 'Preview'}
              </Button>
              {preview ? (
                <Button type="button" onClick={onApprove} disabled={busy}>
                  Submit for approval
                </Button>
              ) : null}
            </div>
          </div>
          {msg ? <p className="text-xs">{msg}</p> : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="p-3 text-sm flex items-baseline justify-between">
              <div className="font-semibold">
                {preview.ruleSetName} · {preview.periodStart} → {preview.periodEnd}
              </div>
              <div>
                کل / Total <Pkr value={preview.totalBonusPkr} mode="lac_crore" />
              </div>
            </div>
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="p-2 text-left">Worker</th>
                  <th className="p-2 text-right">Att %</th>
                  <th className="p-2 text-right">Harvest kg</th>
                  <th className="p-2 text-right">Breakdowns</th>
                  <th className="p-2 text-right">On-time %</th>
                  <th className="p-2 text-right">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.workerId} className="border-t border-[var(--border)]">
                    <td className="p-2">
                      {r.workerCode} {r.workerName}
                    </td>
                    <td className="p-2 text-right">{r.bonusBreakdown.attendancePct}%</td>
                    <td className="p-2 text-right">{r.bonusBreakdown.harvestKg}</td>
                    <td className="p-2 text-right">{r.bonusBreakdown.breakdownEvents}</td>
                    <td className="p-2 text-right">{r.bonusBreakdown.taskOnTimePct}%</td>
                    <td className="p-2 text-right font-semibold">
                      <Pkr value={r.totalBonus} />
                    </td>
                  </tr>
                ))}
                {preview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[var(--muted)]">
                      No bonuses earned this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold mb-2">حالیہ / Recent awards</h3>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--muted)]">
              کوئی نہیں / No awards yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    <th className="p-2 text-left">Worker</th>
                    <th className="p-2 text-left">Period</th>
                    <th className="p-2 text-right">Bonus</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((a) => (
                    <tr key={a.id} className="border-t border-[var(--border)]">
                      <td className="p-2">
                        {a.workerCode} {a.workerName}
                      </td>
                      <td className="p-2">
                        {a.periodStart} → {a.periodEnd}
                      </td>
                      <td className="p-2 text-right">
                        <Pkr value={a.totalBonusPkr} />
                      </td>
                      <td className="p-2 text-xs">
                        {a.paidInPayrollRunId
                          ? 'Paid'
                          : a.approvalRequestId
                            ? 'Pending approval'
                            : 'Draft'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
