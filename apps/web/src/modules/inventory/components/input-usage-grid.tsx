'use client';
import * as React from 'react';
import { BigButton, Pkr, Card, Button, Input } from '@zameen/ui';
import type { InputUsageLogData } from '../input-usage-log-actions';
import { quickIssueInput, getLatestUnitCost } from '../input-usage-log-actions';

export interface InputUsageGridProps {
  entityId: string;
  data: InputUsageLogData;
  cropPlans: Array<{ id: string; fieldId: string; cropName: string }>;
  title: string;
  titleUr: string;
  recordLabel: string;
  recordLabelUr: string;
  itemLabel: string;
  itemLabelUr: string;
  xlsxRoutePrefix: string;
  revalidatePath: string;
}

export function InputUsageGrid({
  entityId,
  data,
  cropPlans,
  title,
  titleUr,
  recordLabel,
  recordLabelUr,
  itemLabel,
  itemLabelUr,
  xlsxRoutePrefix,
  revalidatePath,
}: InputUsageGridProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const [fieldId, setFieldId] = React.useState<string>(data.fields[0]?.id ?? '');
  const [inputId, setInputId] = React.useState<string>(data.inputs[0]?.id ?? '');
  const [date, setDate] = React.useState<string>(today);
  const [qty, setQty] = React.useState<string>('');
  const [unitCost, setUnitCost] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!inputId) return;
    getLatestUnitCost(inputId).then((c) => {
      if (c != null && !unitCost) setUnitCost(String(c));
    });
  }, [inputId]);

  const total = Number(qty || 0) * Number(unitCost || 0);
  const isPesticide = data.inputType === 'pesticide';
  const isSeed = data.inputType === 'seed';

  async function submit() {
    setErr(null);
    if (!fieldId || !inputId || !qty || !unitCost) {
      setErr('سب خانے پُر کریں / Fill all fields');
      return;
    }
    setBusy(true);
    const cropPlan = cropPlans.find((p) => p.fieldId === fieldId);
    const res = await quickIssueInput({
      entityId,
      fieldId,
      inputId,
      cropPlanId: cropPlan?.id,
      issuedOn: new Date(date).toISOString(),
      quantity: Number(qty),
      unitCostPkr: Number(unitCost),
      notes: notes || undefined,
      revalidate: revalidatePath,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Error');
      return;
    }
    setQty('');
    setNotes('');
    setOpen(false);
    location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{titleUr} / {title}</h2>
          <p className="text-sm text-[var(--muted)]">
            {data.fromDate} → {data.toDate} · {data.rows.length} days · کل / Total{' '}
            <Pkr value={data.grandTotalPkr} />
          </p>
        </div>
        <BigButton
          tone="primary"
          label={`${recordLabelUr} / ${recordLabel}`}
          sublabel="ایک ٹیپ / One tap"
          onClick={() => setOpen(true)}
        />
      </div>

      {(isPesticide || isSeed) ? (
        <div className="text-xs text-[var(--muted)]">
          {isPesticide ? 'سرخ علامت: PHI خلاف ورزی / Red flag: applied within pre-harvest interval' : null}
          {isSeed ? 'سرخ علامت: تجویز کردہ ریٹ ±30% سے باہر / Red flag: outside recommended seeding rate ±30%' : null}
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)] p-2 text-left">تاریخ / Date</th>
              {data.fields.map((f) => (
                <th key={f.id} className="p-2 text-right whitespace-nowrap">
                  {f.code}
                  <div className="text-xs font-normal text-[var(--muted)]">{f.acres.toFixed(2)} ac</div>
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap bg-[var(--accent-soft)]">دن کا کل / Day total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.fields.length + 2} className="p-6 text-center text-[var(--muted)]">
                  کوئی اندراج نہیں / No entries.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.date} className="border-t border-[var(--border)]">
                  <td className="sticky left-0 bg-[var(--surface)] p-2 font-medium whitespace-nowrap">{r.date}</td>
                  {data.fields.map((f) => {
                    const c = r.perField[f.id];
                    const flagged = c && (c.phiFlag || c.rateFlag);
                    return (
                      <td
                        key={f.id}
                        className={`p-2 text-right whitespace-nowrap ${flagged ? 'bg-red-500/10 text-red-600' : ''}`}
                        title={
                          c?.phiFlag
                            ? 'PHI violation'
                            : c?.rateFlag
                              ? 'Seeding rate outside recommended ±30%'
                              : undefined
                        }
                      >
                        {c ? (
                          <>
                            <Pkr value={c.totalPkr} />
                            <div className="text-xs text-[var(--muted)]">
                              {c.qty.toFixed(1)} {c.unit}{flagged ? ' ⚠' : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold bg-[var(--accent-soft)] whitespace-nowrap">
                    <Pkr value={r.totalPkr} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
              <td className="sticky left-0 bg-[var(--surface-2)] p-2">کھیت کا کل / Field total</td>
              {data.fields.map((f) => {
                const t = data.fieldTotals[f.id] ?? 0;
                const perAcre = f.acres > 0 ? t / f.acres : 0;
                return (
                  <td key={f.id} className="p-2 text-right whitespace-nowrap">
                    <Pkr value={t} />
                    <div className="text-xs font-normal text-[var(--muted)]">
                      <Pkr value={perAcre} />/ac
                    </div>
                  </td>
                );
              })}
              <td className="p-2 text-right bg-[var(--accent)] text-[var(--accent-fg)]">
                <Pkr value={data.grandTotalPkr} />
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {data.inputs.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">{itemLabelUr} کی قسم سے / By {itemLabel} type</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {data.inputs.map((i) => (
              <div key={i.id} className="rounded-md border border-[var(--border)] p-2">
                <div className="font-medium">{i.nameUr ?? i.name}</div>
                <div className="text-xs text-[var(--muted)]">{i.name}</div>
                {isPesticide && i.preHarvestIntervalDays != null ? (
                  <div className="text-xs text-[var(--muted)]">PHI: {i.preHarvestIntervalDays}d</div>
                ) : null}
                {isPesticide && i.activeIngredient ? (
                  <div className="text-xs text-[var(--muted)]">{i.activeIngredient}</div>
                ) : null}
                <div className="mt-1 text-sm">
                  <Pkr value={data.inputTotals[i.id] ?? 0} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div>
        <a
          href={`${xlsxRoutePrefix}?entityId=${entityId}&from=${data.fromDate}&to=${data.toDate}`}
          className="text-sm underline"
        >
          ایکسل میں ڈاؤن لوڈ / Download XLSX
        </a>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <Card className="w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">نیا اندراج / New entry</h3>

            <label className="block text-sm">
              <span className="block mb-1">کھیت / Field</span>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                {data.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.acres.toFixed(2)} ac
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">{itemLabelUr} / {itemLabel}</span>
              <select
                value={inputId}
                onChange={(e) => {
                  setInputId(e.target.value);
                  setUnitCost('');
                }}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2"
              >
                {data.inputs.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameUr ?? i.name} ({i.unit})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">تاریخ / Date</span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">مقدار / Qty</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">فی یونٹ ریٹ / Rate</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </label>
            </div>

            <div className="rounded-md bg-[var(--surface-2)] p-2 text-sm">
              کل / Total: <Pkr value={total} />
            </div>

            <label className="block text-sm">
              <span className="block mb-1">نوٹس / Notes (optional)</span>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            {err ? <div className="text-sm text-red-500">{err}</div> : null}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy} className="flex-1">
                {busy ? '…' : 'محفوظ / Save'}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                منسوخ / Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
