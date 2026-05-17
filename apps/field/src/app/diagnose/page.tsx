'use client';
import * as React from 'react';
import { Card, CardContent } from '@zameen/ui';

interface DiagnosticResponse {
  diagnostic: {
    id: string;
    diagnosisLabel: string | null;
    confidence: string | null;
    severity: string | null;
    treatmentSuggestion: string | null;
    treatmentSuggestionUr: string | null;
    status: string;
  };
}

interface FieldOption {
  id: string;
  label: string;
}

function severityClass(sev: string | null): string {
  if (sev === 'severe') return 'bg-red-100 text-red-800';
  if (sev === 'moderate') return 'bg-amber-100 text-amber-800';
  if (sev === 'mild') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-700';
}

export default function DiagnosePage() {
  const [fieldId, setFieldId] = React.useState('');
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [diagnosing, setDiagnosing] = React.useState(false);
  const [result, setResult] = React.useState<DiagnosticResponse['diagnostic'] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    fetch('/api/fields/options')
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((j: { options?: FieldOption[] }) => setFields(j.options ?? []))
      .catch(() => setFields([]));
  }, []);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fieldId) {
      setError('کھیت منتخب کریں');
      return;
    }
    setError(null);
    setResult(null);

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const upRes = await fetch('/api/uploads/r2-presign', { method: 'POST', body: fd });
    setUploading(false);
    if (!upRes.ok) {
      setError('اپ لوڈ ناکام');
      return;
    }
    const upJson = (await upRes.json()) as { url: string };

    setDiagnosing(true);
    const diagRes = await fetch('/api/diagnostics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUrl: upJson.url, fieldId }),
    });
    setDiagnosing(false);
    if (!diagRes.ok) {
      setError('تشخیص ناکام');
      return;
    }
    const diagJson = (await diagRes.json()) as DiagnosticResponse;
    setResult(diagJson.diagnostic);
  };

  const treatNow = async () => {
    if (!result) return;
    await fetch('/api/tasks/quick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `علاج: ${result.diagnosisLabel ?? ''}`,
        description: result.treatmentSuggestionUr ?? result.treatmentSuggestion ?? '',
        fieldId,
        relatedDiagnosticId: result.id,
      }),
    }).catch(() => null);
    alert('ٹاسک سپروائزر کو بھیج دیا گیا');
  };

  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)] urdu">فصل کی تشخیص</h1>

      <Card>
        <CardContent className="space-y-3 p-3">
          <label className="block">
            <span className="urdu text-sm">کھیت</span>
            <select
              className="mt-1 block w-full h-11 rounded-md border border-slate-300 bg-white px-3"
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
            >
              <option value="">منتخب کریں</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={onPickFile}
            disabled={uploading || diagnosing}
            className="w-full min-h-[56px] rounded-md bg-emerald-700 text-white text-lg urdu disabled:opacity-50"
          >
            {uploading ? 'اپ لوڈ ہو رہی ہے' : diagnosing ? 'تشخیص ہو رہی ہے' : 'تصویر لیں'}
          </button>

          {error ? <p className="urdu text-right text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardContent className="space-y-3 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{result.diagnosisLabel ?? 'نامعلوم'}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${severityClass(result.severity)}`}>
                {result.severity ?? 'unknown'}
              </span>
            </div>
            <p className="tabular text-xs text-slate-500">
              {((Number(result.confidence) || 0) * 100).toFixed(0)}% اعتماد
            </p>
            <div>
              <p className="urdu text-right text-sm whitespace-pre-line" dir="rtl">
                {result.treatmentSuggestionUr ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={treatNow}
              className="w-full min-h-[56px] rounded-md bg-amber-700 text-white text-lg urdu"
            >
              ابھی علاج کریں
            </button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
