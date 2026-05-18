'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'ok' | 'err';

export function DemoRequestForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);
    const form = event.currentTarget;
    const payload = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      organization: (form.elements.namedItem('organization') as HTMLInputElement).value || null,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value || null,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value || null,
    };
    try {
      const res = await fetch('/api/marketing/demo-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setStatus('ok');
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStatus('err');
    }
  }

  if (status === 'ok') {
    return (
      <div className="border border-[var(--border)] rounded-md p-6 bg-[var(--surface)]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">Received</div>
        <h2 className="font-serif text-2xl mt-2">Thank you.</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-2 leading-relaxed">
          We saved your note. You will hear back at the email you provided within a few days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        Request a demo
      </div>
      <Field name="name" label="Name" required />
      <Field name="email" label="Email" type="email" required />
      <Field name="organization" label="Organization" />
      <Field name="phone" label="Phone" />
      <div className="space-y-1.5">
        <label htmlFor="message" className="block text-xs text-[var(--fg-muted)]">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      {error ? <div className="text-xs text-[var(--danger,#dc2626)]">{error}</div> : null}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--bg)] font-medium hover:opacity-90 transition disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending...' : 'Send request'}
      </button>
    </form>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}

function Field({ name, label, type = 'text', required = false }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-xs text-[var(--fg-muted)]">
        {label}
        {required ? <span className="text-[var(--accent)]"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}
