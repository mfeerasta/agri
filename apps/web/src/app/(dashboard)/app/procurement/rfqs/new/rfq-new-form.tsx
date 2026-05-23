'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@zameen/ui';
import { createRfq } from '@/modules/procurement/rfq-actions';

interface VendorOption {
  id: string;
  name: string;
  category: string | null;
  onTimePct: number;
  quoteAccuracyPct: number;
  totalSpendPkr: number;
}

interface LineItem {
  description: string;
  quantity: string;
  unit: string;
  specs: string;
}

interface Props {
  entityId: string;
  vendors: VendorOption[];
}

export function RfqNewForm({ entityId, vendors }: Props): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [budget, setBudget] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [lines, setLines] = useState<LineItem[]>([{ description: '', quantity: '', unit: '', specs: '' }]);
  const [err, setErr] = useState<string | null>(null);

  const filteredVendors = vendors.filter(
    (v) =>
      !vendorFilter ||
      v.name.toLowerCase().includes(vendorFilter.toLowerCase()) ||
      (v.category ?? '').toLowerCase().includes(vendorFilter.toLowerCase()),
  );

  function toggleVendor(id: string): void {
    setSelectedVendorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateLine(idx: number, key: keyof LineItem, value: string): void {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  function addLine(): void {
    setLines((prev) => [...prev, { description: '', quantity: '', unit: '', specs: '' }]);
  }

  function removeLine(idx: number): void {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit(): void {
    setErr(null);
    const lineItems = lines
      .filter((l) => l.description.trim() && l.quantity && l.unit)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit: l.unit.trim(),
        specifications: l.specs.trim() ? { note: l.specs.trim() } : undefined,
      }));
    if (lineItems.length === 0) {
      setErr('Add at least one line item.');
      return;
    }
    if (selectedVendorIds.length === 0) {
      setErr('Select at least one vendor to invite.');
      return;
    }
    start(async () => {
      const res = await createRfq({
        entityId,
        title,
        description: description || undefined,
        category,
        neededBy: neededBy || undefined,
        budgetEstimatePkr: budget ? Number(budget) : undefined,
        lineItems,
        invitedVendorIds: selectedVendorIds,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push(`/procurement/rfqs/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Title</span>
            <input
              className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="DAP fertilizer 50 bags"
            />
          </label>
          <label className="block">
            <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Category</span>
            <input
              className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="fertilizer / seed / diesel / parts"
            />
          </label>
          <label className="block">
            <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Needed by</span>
            <input
              type="date"
              className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Budget estimate (PKR)</span>
            <input
              type="number"
              className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1 tabular"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Description / notes</span>
            <textarea
              className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="smallcaps text-[0.7rem] mb-2">Line items</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Description</th>
                <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Qty</th>
                <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Unit</th>
                <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Spec</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-[var(--rule)]">
                  <td className="px-2 py-1">
                    <input
                      className="w-full border-0 bg-transparent"
                      value={l.description}
                      onChange={(e) => updateLine(i, 'description', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1 w-24">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent tabular"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1 w-20">
                    <input
                      className="w-full border-0 bg-transparent"
                      value={l.unit}
                      onChange={(e) => updateLine(i, 'unit', e.target.value)}
                      placeholder="bag / kg / L"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full border-0 bg-transparent"
                      value={l.specs}
                      onChange={(e) => updateLine(i, 'specs', e.target.value)}
                      placeholder="grade, brand, etc."
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        className="smallcaps text-[0.65rem] text-[var(--danger)]"
                        onClick={() => removeLine(i)}
                      >
                        remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="mt-2 smallcaps text-[0.7rem] underline"
            onClick={addLine}
          >
            + Add line
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-baseline mb-2">
            <div className="smallcaps text-[0.7rem]">Invite vendors ({selectedVendorIds.length} selected)</div>
            <input
              className="border border-[var(--rule)] bg-transparent px-2 py-1 text-xs"
              placeholder="filter by name or category"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto border border-[var(--rule)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] sticky top-0">
                <tr>
                  <th />
                  <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Name</th>
                  <th className="text-left px-2 py-1 smallcaps text-[0.65rem]">Category</th>
                  <th className="text-right px-2 py-1 smallcaps text-[0.65rem]">On-time %</th>
                  <th className="text-right px-2 py-1 smallcaps text-[0.65rem]">Acc %</th>
                  <th className="text-right px-2 py-1 smallcaps text-[0.65rem]">Spend</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-t border-[var(--rule)] cursor-pointer ${selectedVendorIds.includes(v.id) ? 'bg-[var(--paper-2)]' : ''}`}
                    onClick={() => toggleVendor(v.id)}
                  >
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedVendorIds.includes(v.id)}
                        onChange={() => toggleVendor(v.id)}
                      />
                    </td>
                    <td className="px-2 py-1">{v.name}</td>
                    <td className="px-2 py-1 smallcaps text-[0.65rem]">{v.category ?? '—'}</td>
                    <td className="px-2 py-1 text-right tabular text-xs">{v.onTimePct.toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right tabular text-xs">{v.quoteAccuracyPct.toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right tabular text-xs">
                      {v.totalSpendPkr.toLocaleString('en-PK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {err ? <div className="text-sm text-[var(--danger)]">{err}</div> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40"
        >
          {pending ? 'Saving...' : 'Save as draft'}
        </button>
      </div>
    </div>
  );
}
