'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cropStageLogCreateSchema, type CropStageLogCreateInput } from '@zameen/shared/validators';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PhotoCapture,
  Textarea,
} from '@zameen/ui';
import { logCropStage } from '../actions';
import {
  InlineDiagnosticCard,
  type InlineDiagnosis,
} from '@/modules/diagnostics/components/inline-diagnostic-card';

const STAGES = ['planned', 'land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest', 'post_harvest'] as const;

export function StageLogForm({ cropPlanId, fieldId }: { cropPlanId: string; fieldId?: string }) {
  const form = useForm<CropStageLogCreateInput>({
    resolver: zodResolver(cropStageLogCreateSchema),
    defaultValues: { cropPlanId, stage: 'vegetative', observedOn: new Date().toISOString(), photoUrls: [] },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [diagnoses, setDiagnoses] = React.useState<Record<string, InlineDiagnosis>>({});

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await logCropStage(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/crops/plans/${cropPlanId}`;
  });

  const runDiagnosis = React.useCallback(
    async (url: string) => {
      if (!fieldId) return;
      setDiagnoses((prev) => ({
        ...prev,
        [url]: {
          photoUrl: url,
          diagnosisLabel: '',
          confidence: 0,
          severity: 'unknown',
          treatmentSuggestion: '',
          treatmentSuggestionUr: '',
          loading: true,
        },
      }));
      try {
        const res = await fetch('/api/diagnostics', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            imageUrl: url,
            fieldId,
            cropPlanId,
            stage: form.getValues('stage'),
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          setDiagnoses((prev) => ({
            ...prev,
            [url]: { ...prev[url]!, loading: false, error: errBody.error ?? 'failed' },
          }));
          return;
        }
        const body = (await res.json()) as {
          diagnostic: {
            id: string;
            diagnosisLabel: string;
            confidence: string;
            severity: InlineDiagnosis['severity'];
            treatmentSuggestion: string;
            treatmentSuggestionUr: string;
            status: InlineDiagnosis['status'];
          };
        };
        setDiagnoses((prev) => ({
          ...prev,
          [url]: {
            id: body.diagnostic.id,
            photoUrl: url,
            diagnosisLabel: body.diagnostic.diagnosisLabel,
            confidence: Number(body.diagnostic.confidence),
            severity: body.diagnostic.severity,
            treatmentSuggestion: body.diagnostic.treatmentSuggestion,
            treatmentSuggestionUr: body.diagnostic.treatmentSuggestionUr,
            status: body.diagnostic.status,
            loading: false,
          },
        }));
      } catch {
        setDiagnoses((prev) => ({
          ...prev,
          [url]: { ...prev[url]!, loading: false, error: 'network error' },
        }));
      }
    },
    [cropPlanId, fieldId, form],
  );

  const handlePhotosChange = React.useCallback(
    (urls: string[]) => {
      form.setValue('photoUrls', urls, { shouldValidate: true });
      for (const url of urls) {
        if (!diagnoses[url]) void runDiagnosis(url);
      }
    },
    [diagnoses, form, runDiagnosis],
  );

  const updateStatus = React.useCallback(
    async (id: string | undefined, status: 'confirmed' | 'dismissed') => {
      if (!id) return;
      const { reviewDiagnostic } = await import('@/modules/diagnostics/actions');
      const result = await reviewDiagnostic({ id, status });
      if (result.ok) {
        setDiagnoses((prev) => {
          const next = { ...prev };
          for (const url of Object.keys(next)) {
            if (next[url]!.id === id) next[url] = { ...next[url]!, status };
          }
          return next;
        });
      }
    },
    [],
  );

  const photoUrls = form.watch('photoUrls') ?? [];

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Log stage progression</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stage</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('stage')}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Observed on</Label>
              <Input type="datetime-local" {...form.register('observedOn')} />
            </div>
          </div>
          <div>
            <Label>Notes (English)</Label>
            <Textarea {...form.register('notes')} />
          </div>
          <div>
            <Label>Notes (Urdu)</Label>
            <Textarea dir="rtl" {...form.register('notesUr')} />
          </div>
          <PhotoCapture
            label="Stage photos"
            value={photoUrls}
            onChange={handlePhotosChange}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              const json = await res.json();
              return json.url as string;
            }}
          />
          {fieldId && photoUrls.length > 0 ? (
            <div className="space-y-2">
              <Label>AI diagnosis</Label>
              {photoUrls.map((url) => {
                const d = diagnoses[url];
                if (!d) return null;
                return (
                  <InlineDiagnosticCard
                    key={url}
                    diag={d}
                    onUpdateStatus={(s) => updateStatus(d.id, s)}
                  />
                );
              })}
            </div>
          ) : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Log stage'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
