'use client';

import { useState, useTransition } from 'react';
import { uploadAdvisory } from '../advisory-actions';

export function AdvisoryUploadForm() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>('');

  return (
    <form
      className="space-y-3 rounded border border-stone-300 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const res = await uploadAdvisory({
              pdfUrl: String(fd.get('pdfUrl') ?? ''),
              source: String(fd.get('source') ?? ''),
              title: String(fd.get('title') ?? ''),
              region: String(fd.get('region') ?? '') || undefined,
              publishedOn: String(fd.get('publishedOn') ?? '') || undefined,
            });
            setMessage(`Ingested ${res.id}`);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed');
          }
        });
      }}
    >
      <h2 className="text-lg font-semibold">Upload PARC / FAO advisory</h2>
      <label className="block text-sm">
        Source
        <select name="source" required className="mt-1 block w-full rounded border-stone-300">
          <option value="PARC">PARC</option>
          <option value="FAO">FAO Pakistan</option>
          <option value="PMD">PMD</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        Title
        <input name="title" required className="mt-1 block w-full rounded border-stone-300" />
      </label>
      <label className="block text-sm">
        PDF URL
        <input name="pdfUrl" required type="url" className="mt-1 block w-full rounded border-stone-300" />
      </label>
      <label className="block text-sm">
        Region
        <input name="region" placeholder="Punjab" className="mt-1 block w-full rounded border-stone-300" />
      </label>
      <label className="block text-sm">
        Published on
        <input name="publishedOn" type="date" className="mt-1 block w-full rounded border-stone-300" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Ingesting...' : 'Ingest advisory'}
      </button>
      {message && <p className="text-sm text-stone-700">{message}</p>}
    </form>
  );
}
