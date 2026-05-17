'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BigButton, Card, CardContent, CardHeader, CardTitle, Input } from '@zameen/ui';
import { submitIssuance } from './actions';

const schema = z.object({
  inputId: z.string().uuid(),
  fieldId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitCostPkr: z.coerce.number().nonnegative(),
  receivedBy: z.string().uuid(),
  purpose: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Opt {
  id: string;
  name?: string;
  code?: string;
  fullName?: string;
  unit?: string;
  type?: string;
  acres?: number;
}

export function IssueForm({
  entityId,
  inputs,
  fields,
  workers,
}: {
  entityId: string;
  inputs: Opt[];
  fields: Opt[];
  workers: Opt[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, unitCostPkr: 0 },
  });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(values: FormValues) {
    setBusy(true);
    setMsg(null);
    const totalCostPkr = values.quantity * values.unitCostPkr;
    const r = await submitIssuance({ ...values, entityId, totalCostPkr });
    setBusy(false);
    if (r.ok) {
      setMsg('Issuance recorded');
      form.reset({ quantity: 0, unitCostPkr: 0 });
    } else {
      setMsg(r.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue input from store to field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="smallcaps text-[0.7rem]">Input</label>
            <select
              className="w-full rounded-sm border border-[var(--rule)] bg-[var(--paper)] px-3 py-2"
              {...form.register('inputId')}
            >
              <option value="">— Pick input —</option>
              {inputs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="smallcaps text-[0.7rem]">Field</label>
            <select
              className="w-full rounded-sm border border-[var(--rule)] bg-[var(--paper)] px-3 py-2"
              {...form.register('fieldId')}
            >
              <option value="">— Pick field —</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} {f.name ? `· ${f.name}` : ''} ({f.acres} ac)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="smallcaps text-[0.7rem]">Quantity</label>
              <Input type="number" step="0.0001" {...form.register('quantity')} />
            </div>
            <div className="space-y-1">
              <label className="smallcaps text-[0.7rem]">Unit cost PKR</label>
              <Input type="number" step="0.01" {...form.register('unitCostPkr')} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="smallcaps text-[0.7rem]">Receiving worker</label>
            <select
              className="w-full rounded-sm border border-[var(--rule)] bg-[var(--paper)] px-3 py-2"
              {...form.register('receivedBy')}
            >
              <option value="">— Pick worker —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fullName} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="smallcaps text-[0.7rem]">Purpose</label>
            <Input {...form.register('purpose')} placeholder="e.g. urea broadcast on F-12" />
          </div>

          <BigButton type="submit" label={busy ? 'Saving…' : 'Record issuance'} disabled={busy} />
          {msg ? <p className="text-sm text-[var(--ink)]/70">{msg}</p> : null}
        </CardContent>
      </Card>
    </form>
  );
}
