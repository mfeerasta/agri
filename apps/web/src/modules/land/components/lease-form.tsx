'use client';
import * as React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  leaseContractCreateSchema,
  type LeaseContractCreateInput,
} from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Textarea } from '@zameen/ui';
import { createLeaseContract } from '../lease-actions';

interface FieldOpt {
  id: string;
  code: string;
  name: string | null;
  farmName: string | null;
  blockCode: string | null;
}

interface Props {
  entityId: string;
  fields: FieldOpt[];
}

export function LeaseForm({ entityId, fields: fieldOpts }: Props) {
  const form = useForm<LeaseContractCreateInput>({
    resolver: zodResolver(leaseContractCreateSchema),
    defaultValues: {
      entityId,
      tenure: 'rented_in',
      status: 'active',
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const tenure = form.watch('tenure');
  const isRented = tenure === 'rented_in' || tenure === 'rented_out';
  const isShare = tenure === 'sharecrop_in' || tenure === 'sharecrop_out' || tenure === 'musharka';

  const onSubmit: SubmitHandler<LeaseContractCreateInput> = async (v) => {
    setSubmitting(true);
    setErr(null);
    // Coerce numeric inputs from string-typed form fields
    const payload = {
      ...v,
      annualRentPkr: v.annualRentPkr != null ? Number(v.annualRentPkr) : undefined,
      sharePctLandowner: v.sharePctLandowner != null ? Number(v.sharePctLandowner) : undefined,
      sharePctTenant: v.sharePctTenant != null ? Number(v.sharePctTenant) : undefined,
    };
    const r = await createLeaseContract(payload);
    setSubmitting(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    window.location.href = `/land/leases/${r.id}`;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader><CardTitle>Counterparty &amp; field · فریق اور کھیت</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Field · کھیت</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...form.register('fieldId')}
            >
              <option value="">— select —</option>
              {fieldOpts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name ?? ''} ({f.farmName}/{f.blockCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Tenure · قبضہ کی نوعیت</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...form.register('tenure')}
            >
              <option value="owned">Owned · ملکیتی</option>
              <option value="rented_in">Rented in · کرایہ پر لیا</option>
              <option value="rented_out">Rented out · کرایہ پر دیا</option>
              <option value="sharecrop_in">Sharecrop in · بٹائی پر لیا</option>
              <option value="sharecrop_out">Sharecrop out · بٹائی پر دیا</option>
              <option value="musharka">Musharka · مشارکہ</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Counterparty name · فریق کا نام</Label>
              <Input {...form.register('counterpartyName')} />
            </div>
            <div>
              <Label>CNIC (13 digits)</Label>
              <Input placeholder="xxxxx-xxxxxxx-x" {...form.register('counterpartyCnic')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Phone · فون</Label>
              <Input placeholder="+923xx-xxxxxxx" {...form.register('counterpartyPhone')} />
            </div>
            <div>
              <Label>Deed document URL</Label>
              <Input placeholder="https://..." {...form.register('deedDocUrl')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Start date · شروع</Label>
              <Input type="date" {...form.register('startDate')} />
            </div>
            <div>
              <Label>End date · ختم (optional)</Label>
              <Input type="date" {...form.register('endDate')} />
            </div>
          </div>

          {isRented ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-3">
              <div className="text-xs font-semibold text-amber-900">Rent details · کرایہ</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Annual rent (PKR)</Label>
                  <Input type="number" step="0.01" {...form.register('annualRentPkr', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Payment schedule</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    {...form.register('rentPaymentSchedule')}
                  >
                    <option value="">—</option>
                    <option value="annual">Annual</option>
                    <option value="semi_annual">Semi-annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {isShare ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 space-y-3">
              <div className="text-xs font-semibold text-emerald-900">Share split · حصے کی تقسیم</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Landowner share %</Label>
                  <Input type="number" step="0.01" {...form.register('sharePctLandowner', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Tenant share %</Label>
                  <Input type="number" step="0.01" {...form.register('sharePctTenant', { valueAsNumber: true })} />
                </div>
              </div>
              <p className="text-xs text-emerald-900/80">Must sum to 100. Typical battai is 50/50 or 60/40.</p>
            </div>
          ) : null}

          <div>
            <Label>Notes · یادداشت</Label>
            <Textarea rows={3} {...form.register('notes')} />
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create lease'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
