'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { repairRequestSchema, type RepairRequestInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, PhotoUploader, Textarea } from '@zameen/ui';
import { submitRepairRequest } from '../actions';

export function RepairRequestForm() {
  const form = useForm<RepairRequestInput>({
    resolver: zodResolver(repairRequestSchema),
    defaultValues: { problemPhotoUrls: [], severity: 'minor' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true); setErr(null);
    const r = await submitRepairRequest(v);
    setSubmitting(false);
    if (!r.ok) setErr(r.error);
    else window.location.href = `/repairs/${r.id}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Issue details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Asset (tractor/equipment)</Label><Input placeholder="UUID" {...form.register('assetId')} /></div>
          <div>
            <Label>Severity</Label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('severity')}>
              <option value="operational">Operational</option>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="breakdown">Breakdown</option>
            </select>
          </div>
          <div><Label>What's wrong?</Label><Textarea rows={4} {...form.register('issueDescription')} /></div>
          <div><Label>Urdu (optional)</Label><Textarea rows={3} {...form.register('issueDescriptionUr')} /></div>
          <div><Label>Suggested action</Label><Textarea rows={2} {...form.register('suggestedAction')} /></div>

          <PhotoUploader
            label="Problem photos / videos"
            required
            value={form.watch('problemPhotoUrls') ?? []}
            onChange={(urls) => form.setValue('problemPhotoUrls', urls, { shouldValidate: true })}
            uploadFn={async (file) => {
              const fd = new FormData(); fd.append('file', file);
              const r = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              return (await r.json()).url as string;
            }}
          />
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Submit'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
