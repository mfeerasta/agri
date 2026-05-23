'use client';
import * as React from 'react';
import { Button, Card, CardContent, Input } from '@zameen/ui';
import { createBonusRuleSet } from '../bonus-actions';

export function BonusRuleSetForm({ entityId }: { entityId: string }): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = React.useState('');
  const [attendancePct, setAttendancePct] = React.useState('5');
  const [harvestPerKg, setHarvestPerKg] = React.useState('0.5');
  const [noBreakdownPkr, setNoBreakdownPkr] = React.useState('1000');
  const [taskOnTimePct, setTaskOnTimePct] = React.useState('3');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createBonusRuleSet({
      entityId,
      name,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      rules: {
        attendanceBonusPctOver90: Number(attendancePct) || 0,
        harvestBonusPerKg: Number(harvestPerKg) || 0,
        noBreakdownBonusPkr: Number(noBreakdownPkr) || 0,
        taskCompletionBonusPctOnTime: Number(taskOnTimePct) || 0,
      },
    });
    setBusy(false);
    if (res.ok) {
      setMsg('Saved');
      setName('');
    } else {
      setMsg(res.error);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">نام / Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">From</span>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">To (optional)</span>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">
              Attendance bonus % when &gt;90%
            </span>
            <Input
              type="number"
              step="0.1"
              value={attendancePct}
              onChange={(e) => setAttendancePct(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Harvest bonus PKR per kg</span>
            <Input
              type="number"
              step="0.01"
              value={harvestPerKg}
              onChange={(e) => setHarvestPerKg(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">No-breakdown flat bonus PKR</span>
            <Input
              type="number"
              step="1"
              value={noBreakdownPkr}
              onChange={(e) => setNoBreakdownPkr(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">
              100% on-time task completion bonus %
            </span>
            <Input
              type="number"
              step="0.1"
              value={taskOnTimePct}
              onChange={(e) => setTaskOnTimePct(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save rule set'}
          </Button>
          {msg ? <p className="text-xs text-[var(--muted)]">{msg}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
