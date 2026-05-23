'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { createPaymentOrder } from '@/modules/finance/bank-import-actions';

const PAYMENT_KINDS = ['vendor_payment', 'salary', 'tax', 'loan_repayment', 'utility', 'rent', 'refund', 'other'] as const;

interface AccountOption { id: string; label: string; }

export default function NewPaymentOrderPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [payeeAccount, setPayeeAccount] = useState('');
  const [payeeIban, setPayeeIban] = useState('');
  const [payeeBank, setPayeeBank] = useState('');
  const [payeeCnic, setPayeeCnic] = useState('');
  const [amountPkr, setAmountPkr] = useState('');
  const [paymentKind, setPaymentKind] = useState<(typeof PAYMENT_KINDS)[number]>('vendor_payment');
  const [scheduledFor, setScheduledFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/banking/accounts')
      .then((r) => r.json())
      .then((data: { accounts: AccountOption[] }) => {
        setAccounts(data.accounts ?? []);
        if (data.accounts?.[0]) setFromAccountId(data.accounts[0].id);
      })
      .catch(() => setAccounts([]));
  }, []);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createPaymentOrder({
      fromAccountId,
      payeeName,
      payeeAccount: payeeAccount || undefined,
      payeeIban: payeeIban || undefined,
      payeeBank: payeeBank || undefined,
      payeeCnic: payeeCnic || undefined,
      amountPkr: Number(amountPkr),
      paymentKind,
      scheduledFor: scheduledFor || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push('/finance/banking/dashboard' as never);
  }

  return (
    <div className="space-y-3">
      <Masthead section="NEW PAYMENT ORDER" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Payment details</CardTitle></CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">From account</span>
              <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payment kind</span>
              <select value={paymentKind} onChange={(e) => setPaymentKind(e.target.value as typeof paymentKind)} className="w-full rounded-md border border-[var(--rule)] p-2">
                {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payee name</span>
              <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payee bank</span>
              <input value={payeeBank} onChange={(e) => setPayeeBank(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payee account</span>
              <input value={payeeAccount} onChange={(e) => setPayeeAccount(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payee IBAN</span>
              <input value={payeeIban} onChange={(e) => setPayeeIban(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Payee CNIC (for salary/refund)</span>
              <input value={payeeCnic} onChange={(e) => setPayeeCnic(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Amount (PKR)</span>
              <input type="number" value={amountPkr} onChange={(e) => setAmountPkr(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2 tabular" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Scheduled for</span>
              <input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="w-full rounded-md border border-[var(--rule)] p-2" />
            </label>
          </div>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <div className="flex gap-2 pt-2">
            <button
              disabled={busy || !fromAccountId || !payeeName || !amountPkr}
              onClick={submit}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {busy ? 'Submitting...' : 'Submit for approval'}
            </button>
            <p className="text-xs text-slate-500 self-center">Payment is held until the Approver PWA signs off.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
