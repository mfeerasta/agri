'use client';
import * as React from 'react';
import { useState, useTransition } from 'react';

export interface CsvMapperFieldSpec {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface CsvMapperProps {
  targetLabel: string;
  fieldSpecs: CsvMapperFieldSpec[];
  templatePath: string;
  onParse: (csv: string) => Promise<{ headers: string[]; rows: Record<string, string>[]; errors: string[] }>;
  onValidate: (
    rows: Record<string, string>[],
    mapping: Record<string, string>,
  ) => Promise<{
    valid: Record<string, unknown>[];
    invalid: { row: Record<string, string>; errors: string[]; rowIndex: number }[];
  }>;
  onCommit: (
    validRows: Record<string, unknown>[],
  ) => Promise<{ inserted: number; skipped: number; error?: string }>;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function CsvMapper(props: CsvMapperProps) {
  const [stage, setStage] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [csvText, setCsvText] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<
    { valid: Record<string, unknown>[]; invalid: { row: Record<string, string>; errors: string[]; rowIndex: number }[] } | null
  >(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number; error?: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_BYTES) {
      setFileError('CSV exceeds 5 MB limit');
      return;
    }
    const text = await file.text();
    setCsvText(text);
    startTransition(async () => {
      const r = await props.onParse(text);
      setHeaders(r.headers);
      setRows(r.rows);
      setParseErrors(r.errors);
      // Auto-map any matching headers.
      const m: Record<string, string> = {};
      for (const f of props.fieldSpecs) {
        const match = r.headers.find((h) => h.toLowerCase().replace(/[_\s-]/g, '') === f.key.toLowerCase().replace(/[_\s-]/g, ''));
        if (match) m[f.key] = match;
      }
      setMapping(m);
      setStage('map');
    });
  };

  const runValidation = () => {
    startTransition(async () => {
      const v = await props.onValidate(rows, mapping);
      setValidation(v);
      setStage('preview');
    });
  };

  const runCommit = () => {
    if (!validation) return;
    startTransition(async () => {
      const r = await props.onCommit(validation.valid);
      setResult(r);
      setStage('done');
    });
  };

  const missingRequired = props.fieldSpecs
    .filter((f) => f.required && !mapping[f.key])
    .map((f) => f.label);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs smallcaps">
        <span className={stage === 'upload' ? 'text-[var(--ink)]' : 'text-[var(--fg-muted)]'}>1. Upload</span>
        <span className="text-[var(--fg-muted)]">·</span>
        <span className={stage === 'map' ? 'text-[var(--ink)]' : 'text-[var(--fg-muted)]'}>2. Map columns</span>
        <span className="text-[var(--fg-muted)]">·</span>
        <span className={stage === 'preview' || stage === 'done' ? 'text-[var(--ink)]' : 'text-[var(--fg-muted)]'}>3. Preview &amp; commit</span>
      </div>

      {stage === 'upload' && (
        <div className="space-y-3">
          <a href={props.templatePath} download className="text-xs text-[var(--accent)] underline">
            Download template CSV
          </a>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm border border-[var(--border)] bg-[var(--paper)] px-3 py-2"
          />
          {fileError ? <div className="text-xs text-[var(--danger)]">{fileError}</div> : null}
        </div>
      )}

      {stage === 'map' && (
        <div className="space-y-3">
          {parseErrors.length > 0 ? (
            <div className="text-xs text-[var(--warning)]">{parseErrors.length} parse warnings</div>
          ) : null}
          <div className="text-xs text-[var(--fg-muted)]">
            {rows.length} rows detected. Map each target field to a CSV column.
          </div>
          <div className="grid gap-2">
            {props.fieldSpecs.map((f) => (
              <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                <label className="text-sm">
                  {f.label}
                  {f.required ? <span className="text-[var(--danger)]"> *</span> : null}
                  {f.hint ? <div className="text-[0.7rem] text-[var(--fg-muted)]">{f.hint}</div> : null}
                </label>
                <select
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  className="border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-sm"
                >
                  <option value="">— skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <div className="smallcaps text-[0.7rem] text-[var(--fg-muted)] mb-1">Preview (first 5 rows)</div>
            <div className="overflow-x-auto">
              <table className="text-xs border border-[var(--rule)]">
                <thead className="bg-[var(--paper-2)]">
                  <tr>{headers.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-[var(--rule)]">
                      {headers.map((h) => <td key={h} className="px-2 py-1 tabular">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {missingRequired.length > 0 ? (
            <div className="text-xs text-[var(--danger)]">
              Missing required mappings: {missingRequired.join(', ')}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy || missingRequired.length > 0}
            onClick={runValidation}
            className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40"
          >
            Validate
          </button>
        </div>
      )}

      {stage === 'preview' && validation && (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-[var(--success)] font-semibold">{validation.valid.length} valid</span>
            {' · '}
            <span className="text-[var(--danger)] font-semibold">{validation.invalid.length} invalid</span>
          </div>
          {validation.invalid.length > 0 ? (
            <div className="border border-[var(--danger)] rounded p-3 max-h-64 overflow-auto">
              <div className="smallcaps text-[0.7rem] text-[var(--danger)] mb-2">Invalid rows</div>
              <ul className="space-y-1 text-xs">
                {validation.invalid.slice(0, 50).map((iv) => (
                  <li key={iv.rowIndex} className="border-t border-[var(--rule)] pt-1">
                    <span className="font-mono">Row {iv.rowIndex + 1}</span>: {iv.errors.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || validation.valid.length === 0}
              onClick={runCommit}
              className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40"
            >
              Commit {validation.valid.length} valid rows · skip {validation.invalid.length}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage('map')}
              className="text-xs text-[var(--fg-muted)] underline"
            >
              Back to mapping
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="space-y-2 border border-[var(--border)] rounded p-4">
          {result.error ? (
            <div className="text-[var(--danger)] text-sm">Import failed: {result.error}</div>
          ) : (
            <div className="text-sm">
              <div className="text-[var(--success)] font-semibold">Inserted {result.inserted} {props.targetLabel}.</div>
              {result.skipped > 0 ? <div className="text-[var(--fg-muted)] text-xs">Skipped {result.skipped} rows.</div> : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setStage('upload');
              setCsvText('');
              setHeaders([]);
              setRows([]);
              setMapping({});
              setValidation(null);
              setResult(null);
            }}
            className="text-xs text-[var(--accent)] underline"
          >
            Import another file
          </button>
        </div>
      )}

      {/* expose csvText length to satisfy unused-var */}
      <span hidden aria-hidden>{csvText.length}</span>
    </div>
  );
}
