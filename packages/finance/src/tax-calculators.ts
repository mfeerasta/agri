// Pakistan tax + zakat + ushr calculators. PKR only.
// Punjab Agricultural Income Tax: dual basis (land area slab OR income slab,
// whichever is higher). Slabs reflect the Punjab Agricultural Income Tax Act
// 1997 schedule as currently in force. Update via configuration if amended.

export interface PunjabKctSlab {
  fromAcres: number;
  toAcres: number | null;
  amountPerAcrePkr: number;
}

export interface PunjabIncomeSlab {
  fromPkr: number;
  toPkr: number | null;
  basePkr: number;
  marginalPct: number;
}

// Cultivated land slabs (irrigated equivalent). Mature orchards count as 2x.
export const PUNJAB_KCT_LAND_SLABS: PunjabKctSlab[] = [
  { fromAcres: 0, toAcres: 12.5, amountPerAcrePkr: 0 },
  { fromAcres: 12.5, toAcres: 25, amountPerAcrePkr: 300 },
  { fromAcres: 25, toAcres: 50, amountPerAcrePkr: 400 },
  { fromAcres: 50, toAcres: null, amountPerAcrePkr: 500 },
];

export const PUNJAB_INCOME_SLABS: PunjabIncomeSlab[] = [
  { fromPkr: 0, toPkr: 400_000, basePkr: 0, marginalPct: 0 },
  { fromPkr: 400_000, toPkr: 800_000, basePkr: 1_000, marginalPct: 0 },
  { fromPkr: 800_000, toPkr: 1_200_000, basePkr: 2_000, marginalPct: 0 },
  { fromPkr: 1_200_000, toPkr: 2_400_000, basePkr: 5_000, marginalPct: 5 },
  { fromPkr: 2_400_000, toPkr: 4_800_000, basePkr: 65_000, marginalPct: 10 },
  { fromPkr: 4_800_000, toPkr: null, basePkr: 305_000, marginalPct: 15 },
];

export interface PunjabAitInput {
  cultivatedAcres: number;
  matureOrchardAcres?: number;
  netAgriIncomePkr?: number;
}

export interface PunjabAitResult {
  landBasisPkr: number;
  incomeBasisPkr: number;
  payablePkr: number;
  basis: 'land' | 'income' | 'either';
}

export function computePunjabAit(input: PunjabAitInput): PunjabAitResult {
  const effectiveAcres = input.cultivatedAcres + 2 * (input.matureOrchardAcres ?? 0);
  let landBasis = 0;
  let remaining = effectiveAcres;
  for (const slab of PUNJAB_KCT_LAND_SLABS) {
    if (remaining <= 0) break;
    const span = (slab.toAcres ?? Number.POSITIVE_INFINITY) - slab.fromAcres;
    const taxable = Math.max(0, Math.min(remaining, effectiveAcres - slab.fromAcres));
    if (taxable > 0 && effectiveAcres > slab.fromAcres) {
      const inSlab = Math.min(taxable, span);
      landBasis += inSlab * slab.amountPerAcrePkr;
      remaining -= inSlab;
    }
  }

  let incomeBasis = 0;
  const inc = input.netAgriIncomePkr ?? 0;
  for (const slab of PUNJAB_INCOME_SLABS) {
    if (inc > slab.fromPkr && (slab.toPkr === null || inc <= slab.toPkr)) {
      incomeBasis = slab.basePkr + ((inc - slab.fromPkr) * slab.marginalPct) / 100;
      break;
    }
  }
  const payable = Math.max(landBasis, incomeBasis);
  return {
    landBasisPkr: Math.round(landBasis * 100) / 100,
    incomeBasisPkr: Math.round(incomeBasis * 100) / 100,
    payablePkr: Math.round(payable * 100) / 100,
    basis: landBasis === incomeBasis ? 'either' : landBasis > incomeBasis ? 'land' : 'income',
  };
}

// Ushr: 5pct if artificially irrigated, 10pct if rain fed.
export function computeUshr(grossProduceKg: number, irrigated: boolean): {
  ratePct: number;
  ushrKg: number;
} {
  const ratePct = irrigated ? 5 : 10;
  return {
    ratePct,
    ushrKg: Math.round((grossProduceKg * ratePct) / 100 * 100) / 100,
  };
}

// Zakat: 2.5pct on net zakatable wealth above nisab. Nisab is the gold/silver
// floor; supply current PKR equivalent via input.
export interface ZakatInput {
  nisabPkr: number;
  cashPkr: number;
  bankBalancesPkr: number;
  receivablesPkr: number;
  inventoryValuePkr: number;
  liquidLivestockValuePkr: number;
  debtsOwedPkr: number;
}

export interface ZakatResult {
  netZakatableWealthPkr: number;
  meetsNisab: boolean;
  zakatDuePkr: number;
}

export function computeZakat(input: ZakatInput): ZakatResult {
  const gross =
    input.cashPkr +
    input.bankBalancesPkr +
    input.receivablesPkr +
    input.inventoryValuePkr +
    input.liquidLivestockValuePkr;
  const net = Math.max(0, gross - input.debtsOwedPkr);
  const meetsNisab = net >= input.nisabPkr;
  const due = meetsNisab ? net * 0.025 : 0;
  return {
    netZakatableWealthPkr: Math.round(net * 100) / 100,
    meetsNisab,
    zakatDuePkr: Math.round(due * 100) / 100,
  };
}

// Days-to-due bucket used by the tax due cron.
export function daysToDueBucket(dueOn: Date, now: Date = new Date()): number {
  const ms = dueOn.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export const TAX_DUE_ALERT_DAYS = [30, 14, 7, 3, 1, 0, -1, -3, -7] as const;
