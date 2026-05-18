export interface AmortRow {
  period: number;
  dueOn: string;
  principalPkr: number;
  interestPkr: number;
  balancePkr: number;
}

export interface AmortInput {
  principalPkr: number;
  ratePct: number;
  disbursementDate: string;
  maturityDate: string;
}

/**
 * Monthly amortization, equal installments. Period count derived from disbursement -> maturity (months).
 */
export function buildAmortization(input: AmortInput): AmortRow[] {
  const start = new Date(input.disbursementDate);
  const end = new Date(input.maturityDate);
  const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
  const r = input.ratePct / 100 / 12;
  const n = months;
  const pmt = r === 0
    ? input.principalPkr / n
    : (input.principalPkr * r) / (1 - Math.pow(1 + r, -n));

  let balance = input.principalPkr;
  const rows: AmortRow[] = [];
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const principal = pmt - interest;
    balance = Math.max(0, balance - principal);
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    rows.push({
      period: i,
      dueOn: due.toISOString().slice(0, 10),
      principalPkr: Number(principal.toFixed(2)),
      interestPkr: Number(interest.toFixed(2)),
      balancePkr: Number(balance.toFixed(2)),
    });
  }
  return rows;
}
