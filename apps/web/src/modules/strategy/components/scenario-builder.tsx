'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { simulateScenario } from '../actions';
import type { ScenarioInputs, ScenarioResult } from '@zameen/finance';

interface PreviousSim {
  id: string;
  scenarioName: string;
  npvPkr: number;
  irrPct: number | null;
  paybackYears: number | null;
}

export function ScenarioBuilder({
  planId,
  baseYear,
  horizonYears,
  previousSims,
}: {
  planId: string;
  baseYear: number;
  horizonYears: number;
  previousSims: PreviousSim[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scenarioName, setScenarioName] = useState(`Scenario ${new Date().toISOString().slice(0, 10)}`);
  const [discountRate, setDiscountRate] = useState(15);
  const [inflation, setInflation] = useState(8);
  const [weatherRisk, setWeatherRisk] = useState(12);
  const [fixedOpex, setFixedOpex] = useState(2_000_000);
  const [monteCarlo, setMonteCarlo] = useState(0);

  // Single-field x year assumption row for quick first pass.
  const [revenuePerYear, setRevenuePerYear] = useState(15_000_000);
  const [opexPerYear, setOpexPerYear] = useState(9_000_000);
  const [yieldVar, setYieldVar] = useState(15);
  const [priceVar, setPriceVar] = useState(10);

  // Capex items.
  const [capexItems, setCapexItems] = useState([
    { name: 'New tractor', year: baseYear + 1, amountPkr: 3_500_000, usefulLifeYears: 12, financedPct: 60, loanRatePct: 17, loanTermYears: 5 },
  ]);

  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addCapex() {
    setCapexItems((c) => [
      ...c,
      { name: 'New initiative', year: baseYear + 1, amountPkr: 1_000_000, usefulLifeYears: 10, financedPct: 50, loanRatePct: 16, loanTermYears: 5 },
    ]);
  }

  function updateCapex<K extends keyof (typeof capexItems)[number]>(idx: number, k: K, v: (typeof capexItems)[number][K]) {
    setCapexItems((c) => c.map((row, i) => (i === idx ? { ...row, [k]: v } : row)));
  }

  function buildInputs(): ScenarioInputs {
    const fieldYearAssumptions = Array.from({ length: horizonYears }, (_, i) => ({
      fieldId: 'aggregate',
      year: baseYear + i,
      cropCode: 'mixed',
      acres: 1,
      yieldPerAcreKg: revenuePerYear,
      yieldVariancePct: yieldVar,
      pricePerKgPkr: 1,
      priceVariancePct: priceVar,
      opexPerAcrePkr: opexPerYear,
    }));
    return {
      baseYear,
      horizonYears,
      discountRatePct: discountRate,
      weatherRiskPct: weatherRisk,
      inflationPct: inflation,
      fixedOpexPerYearPkr: fixedOpex,
      fieldYearAssumptions,
      capexItems,
      monteCarloIterations: monteCarlo > 0 ? monteCarlo : undefined,
    };
  }

  async function run() {
    setError(null);
    setResult(null);
    start(async () => {
      const res = await simulateScenario({ planId, scenarioName, inputs: buildInputs() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Compute locally too so we render immediately; server has persisted it.
      const { runScenario } = await import('@zameen/finance');
      setResult(runScenario(buildInputs()));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Scenario assumptions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Scenario name">
            <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} className={inp} />
          </Field>
          <Field label="Discount rate %">
            <input type="number" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Inflation %">
            <input type="number" value={inflation} onChange={(e) => setInflation(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Weather risk stdev %">
            <input type="number" value={weatherRisk} onChange={(e) => setWeatherRisk(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Fixed opex / year (PKR)">
            <input type="number" value={fixedOpex} onChange={(e) => setFixedOpex(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Monte Carlo iterations (0 = off)">
            <input type="number" value={monteCarlo} onChange={(e) => setMonteCarlo(Number(e.target.value))} className={inp} />
          </Field>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Revenue and opex assumptions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="Expected revenue per year (PKR)">
            <input type="number" value={revenuePerYear} onChange={(e) => setRevenuePerYear(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Expected opex per year (PKR)">
            <input type="number" value={opexPerYear} onChange={(e) => setOpexPerYear(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Yield variance %">
            <input type="number" value={yieldVar} onChange={(e) => setYieldVar(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Price variance %">
            <input type="number" value={priceVar} onChange={(e) => setPriceVar(Number(e.target.value))} className={inp} />
          </Field>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Capex schedule</h2>
          <button type="button" onClick={addCapex} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            + Add capex item
          </button>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Year</th>
              <th className="px-2 py-1">Amount (PKR)</th>
              <th className="px-2 py-1">Useful life (yrs)</th>
              <th className="px-2 py-1">Financed %</th>
              <th className="px-2 py-1">Loan rate %</th>
              <th className="px-2 py-1">Term (yrs)</th>
            </tr>
          </thead>
          <tbody>
            {capexItems.map((c, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-2 py-1">
                  <input value={c.name} onChange={(e) => updateCapex(idx, 'name', e.target.value)} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.year} onChange={(e) => updateCapex(idx, 'year', Number(e.target.value))} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.amountPkr} onChange={(e) => updateCapex(idx, 'amountPkr', Number(e.target.value))} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.usefulLifeYears} onChange={(e) => updateCapex(idx, 'usefulLifeYears', Number(e.target.value))} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.financedPct} onChange={(e) => updateCapex(idx, 'financedPct', Number(e.target.value))} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.loanRatePct} onChange={(e) => updateCapex(idx, 'loanRatePct', Number(e.target.value))} className={inpSm} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" value={c.loanTermYears} onChange={(e) => updateCapex(idx, 'loanTermYears', Number(e.target.value))} className={inpSm} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? 'Running...' : 'Run scenario'}
        </button>
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>

      {result && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Result</h2>
          <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <Metric label="NPV (PKR)" value={result.npvPkr.toLocaleString()} />
            <Metric label="IRR %" value={result.irrPct != null ? result.irrPct.toFixed(2) : '—'} />
            <Metric label="Payback (yrs)" value={result.paybackYears != null ? result.paybackYears.toFixed(2) : '—'} />
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-1">Year</th>
                <th className="px-2 py-1">Revenue</th>
                <th className="px-2 py-1">Opex</th>
                <th className="px-2 py-1">Capex</th>
                <th className="px-2 py-1">Financing</th>
                <th className="px-2 py-1">Net cash</th>
                <th className="px-2 py-1">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {result.yearly.map((y) => (
                <tr key={y.year} className="border-t border-slate-100 tabular-nums">
                  <td className="px-2 py-1">{y.year}</td>
                  <td className="px-2 py-1">{y.revenuePkr.toLocaleString()}</td>
                  <td className="px-2 py-1">{y.opexPkr.toLocaleString()}</td>
                  <td className="px-2 py-1">{y.capexPkr.toLocaleString()}</td>
                  <td className="px-2 py-1">{y.financingPkr.toLocaleString()}</td>
                  <td className={`px-2 py-1 ${y.netCashFlowPkr < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {y.netCashFlowPkr.toLocaleString()}
                  </td>
                  <td className="px-2 py-1">{y.cumulativeCashPkr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.monteCarlo && (
            <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
              <div className="font-medium">Monte Carlo (p5 / p50 / p95 NPV)</div>
              <div className="tabular-nums">
                {result.monteCarlo.npvP5.toLocaleString()} / {result.monteCarlo.npvP50.toLocaleString()} /{' '}
                {result.monteCarlo.npvP95.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {previousSims.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Compare with previous scenarios</h2>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-1">Scenario</th>
                <th className="px-2 py-1">NPV (PKR)</th>
                <th className="px-2 py-1">IRR %</th>
                <th className="px-2 py-1">Payback (yrs)</th>
              </tr>
            </thead>
            <tbody>
              {previousSims.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 tabular-nums">
                  <td className="px-2 py-1">{s.scenarioName}</td>
                  <td className="px-2 py-1">{s.npvPkr.toLocaleString()}</td>
                  <td className="px-2 py-1">{s.irrPct != null ? s.irrPct.toFixed(2) : '—'}</td>
                  <td className="px-2 py-1">{s.paybackYears != null ? s.paybackYears.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inp = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';
const inpSm = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
