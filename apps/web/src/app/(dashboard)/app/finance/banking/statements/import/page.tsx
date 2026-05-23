'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { importStatementCsv } from '@/modules/finance/bank-import-actions';

interface AccountOption {
  id: string;
  label: string;
}

export default function ImportStatementPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [statementUrl, setStatementUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/banking/accounts')
      .then((r) => r.json())
      .then((data: { accounts: AccountOption[] }) => {
        setAccounts(data.accounts ?? []);
        if (data.accounts?.[0]) setAccountId(data.accounts[0].id);
      })
      .catch(() => setAccounts([]));
  }, []);

  async function onFile(file: File) {
    const text = await file.text();
    setCsvText(text);
  }

  async function submit() {
    setError(null);
    setResult(null);
    setBusy(true);
    const res = await importStatementCsv({ accountId, csvText, statementUrl: statementUrl || undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(`Imported ${res.imported} rows (format: ${res.format}). Statement ${res.statementId.slice(0, 8)}.`);
    setCsvText('');
  }

  return (
    <div className="space-y-3">
      <Masthead section="IMPORT BANK STATEMENT" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Upload CSV from HBL / MCB / UBL / Faysal / Meezan</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-4">
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-md border border-[var(--rule)] p-2"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">CSV text (paste or auto-filled)</span>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-[var(--rule)] p-2 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Original statement URL (optional)</span>
            <input
              value={statementUrl}
              onChange={(e) => setStatementUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--rule)] p-2"
              placeholder="https://..."
            />
          </label>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          {result ? <div className="text-sm text-emerald-700">{result}</div> : null}
          <button
            disabled={busy || !accountId || !csvText.trim()}
            onClick={submit}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? 'Importing...' : 'Import and auto-match'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
