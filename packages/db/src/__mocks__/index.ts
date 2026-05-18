/**
 * In-memory mock of @zameen/db used by unit tests.
 *
 * Mirrors just enough of the Drizzle query builder API to let the engines
 * (approvals, finance, notifications) run without a live Postgres. Data lives
 * in Maps keyed by table name. Tables are Proxies that vend column descriptors,
 * so any property access on a "table" returns a stable `{__col, table, name}`
 * descriptor that the where-clause helpers (`eq`, `and`, ...) close over.
 *
 * Reset between tests with `resetDb()`. Seed data with `seedDb({...})`.
 */

// ---------- types ----------

interface ColDesc {
  __col: true;
  table: string;
  name: string;
}

interface TableMeta {
  __t: true;
  name: string;
}

type Row = Record<string, unknown>;

// Predicate AST nodes — what `eq`/`and`/etc return.
type Pred =
  | { kind: 'true' }
  | { kind: 'eq'; col: ColDesc; val: unknown }
  | { kind: 'ne'; col: ColDesc; val: unknown }
  | { kind: 'gte'; col: ColDesc; val: unknown }
  | { kind: 'lte'; col: ColDesc; val: unknown }
  | { kind: 'inArray'; col: ColDesc; vals: unknown[] }
  | { kind: 'isNull'; col: ColDesc }
  | { kind: 'and'; parts: Pred[] }
  | { kind: 'or'; parts: Pred[] };

// ---------- store ----------

const TABLES = new Map<string, Row[]>();
const TABLE_REGISTRY = new Map<string, TableMeta>();

function tableRows(name: string): Row[] {
  let r = TABLES.get(name);
  if (!r) {
    r = [];
    TABLES.set(name, r);
  }
  return r;
}

function makeTable(name: string): TableMeta {
  const existing = TABLE_REGISTRY.get(name);
  if (existing) return existing;
  const meta: TableMeta = { __t: true, name };
  const proxy = new Proxy(meta as unknown as Record<string, unknown>, {
    get(target, prop, recv) {
      if (typeof prop === 'symbol' || prop === '__t' || prop === 'name') {
        return Reflect.get(target, prop, recv);
      }
      const desc: ColDesc = { __col: true, table: name, name: String(prop) };
      return desc;
    },
  }) as unknown as TableMeta;
  TABLE_REGISTRY.set(name, proxy);
  return proxy;
}

function isCol(x: unknown): x is ColDesc {
  return Boolean(x && typeof x === 'object' && (x as ColDesc).__col === true);
}

function isTable(x: unknown): x is TableMeta {
  return Boolean(x && typeof x === 'object' && (x as TableMeta).__t === true);
}

// ---------- predicate helpers (drizzle-orm shim) ----------

export function eq(col: ColDesc, val: unknown): Pred {
  return { kind: 'eq', col, val };
}
export function ne(col: ColDesc, val: unknown): Pred {
  return { kind: 'ne', col, val };
}
export function and(...parts: Array<Pred | undefined | null | false>): Pred {
  return { kind: 'and', parts: parts.filter(Boolean) as Pred[] };
}
export function or(...parts: Array<Pred | undefined | null | false>): Pred {
  return { kind: 'or', parts: parts.filter(Boolean) as Pred[] };
}
export function inArray(col: ColDesc, vals: unknown[]): Pred {
  return { kind: 'inArray', col, vals };
}
export function gte(col: ColDesc, val: unknown): Pred {
  return { kind: 'gte', col, val };
}
export function lte(col: ColDesc, val: unknown): Pred {
  return { kind: 'lte', col, val };
}
export function isNull(col: ColDesc): Pred {
  return { kind: 'isNull', col };
}
export function desc(col: ColDesc): { __order: 'desc'; col: ColDesc } {
  return { __order: 'desc', col };
}
export function asc(col: ColDesc): { __order: 'asc'; col: ColDesc } {
  return { __order: 'asc', col };
}
export function sql(_strings?: unknown, ..._args: unknown[]): { __sql: true } {
  return { __sql: true };
}

function evalPred(p: Pred | undefined, row: Row): boolean {
  if (!p) return true;
  switch (p.kind) {
    case 'true':
      return true;
    case 'eq':
      return row[p.col.name] === p.val;
    case 'ne':
      return row[p.col.name] !== p.val;
    case 'gte':
      return cmp(row[p.col.name], p.val) >= 0;
    case 'lte':
      return cmp(row[p.col.name], p.val) <= 0;
    case 'inArray':
      return p.vals.includes(row[p.col.name]);
    case 'isNull':
      return row[p.col.name] == null;
    case 'and':
      return p.parts.every((q) => evalPred(q, row));
    case 'or':
      return p.parts.some((q) => evalPred(q, row));
  }
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// ---------- query builder ----------

interface SelectChain {
  from: (t: TableMeta) => SelectChain;
  innerJoin: (..._args: unknown[]) => SelectChain;
  where: (p?: Pred) => SelectChain;
  limit: (n: number) => SelectChain;
  orderBy: (..._args: unknown[]) => SelectChain;
  groupBy: (..._args: unknown[]) => SelectChain;
  then: <T>(resolve: (rows: Row[]) => T, reject?: (e: unknown) => unknown) => Promise<T>;
}

function makeSelect(projection?: Record<string, unknown>): SelectChain {
  let table: TableMeta | null = null;
  let pred: Pred | undefined;
  let limitN: number | undefined;
  let grouped = false;
  let groupCols: ColDesc[] = [];

  const chain: SelectChain = {
    from(t) {
      table = t;
      return chain;
    },
    innerJoin() {
      return chain;
    },
    where(p) {
      pred = p;
      return chain;
    },
    limit(n) {
      limitN = n;
      return chain;
    },
    orderBy() {
      return chain;
    },
    groupBy(...cols) {
      grouped = true;
      groupCols = cols.filter(isCol);
      return chain;
    },
    then(resolve, reject) {
      try {
        if (!table) return Promise.resolve(resolve([]));
        let rows = tableRows(table.name).filter((r) => evalPred(pred, r));
        if (limitN != null) rows = rows.slice(0, limitN);

        // Handle projection / sql aggregates. We support a tiny shape used by
        // the engines: projections containing `costPool: table.costPool,
        // total: sql<string>...sum(amount)`. Detect a sql-marker field and
        // sum the numeric column on the row matching the group key.
        if (projection) {
          const fields = Object.entries(projection);
          // Find sql aggregate fields (value === {__sql:true}). For each one,
          // we infer the source by name: 'total' over `amountPkr`, etc. To
          // keep this small, we look for a numeric field on the row that
          // matches the projection key, or fall back to summing
          // `amountPkr`/`netReceivedPkr`/`debitPkr`/`creditPkr`.
          const sqlKeys = fields.filter(([, v]) => isSql(v)).map(([k]) => k);
          const colKeys = fields.filter(([, v]) => isCol(v)) as Array<[string, ColDesc]>;
          if (grouped && groupCols.length > 0) {
            const groups = new Map<string, Row[]>();
            for (const r of rows) {
              const key = groupCols.map((c) => String(r[c.name])).join('|');
              const bucket = groups.get(key) ?? [];
              bucket.push(r);
              groups.set(key, bucket);
            }
            const out: Row[] = [];
            for (const bucket of groups.values()) {
              const o: Row = {};
              for (const [k, c] of colKeys) o[k] = bucket[0]![c.name];
              for (const k of sqlKeys) o[k] = sumForKey(k, bucket).toString();
              out.push(o);
            }
            return Promise.resolve(resolve(out));
          }
          // No groupBy — return a single aggregate row when sql fields exist.
          if (sqlKeys.length > 0) {
            const o: Row = {};
            for (const [k, c] of colKeys) o[k] = rows[0]?.[c.name];
            for (const k of sqlKeys) o[k] = sumForKey(k, rows).toString();
            return Promise.resolve(resolve([o]));
          }
          // Plain projection of columns.
          const out = rows.map((r) => {
            const o: Row = {};
            for (const [k, c] of colKeys) o[k] = r[c.name];
            return o;
          });
          return Promise.resolve(resolve(out));
        }

        return Promise.resolve(resolve(rows));
      } catch (e) {
        if (reject) return Promise.resolve(reject(e));
        return Promise.reject(e);
      }
    },
  };
  return chain;
}

function isSql(x: unknown): boolean {
  return Boolean(x && typeof x === 'object' && (x as { __sql?: boolean }).__sql === true);
}

// Best-effort: pick a numeric field on the rows. Engines we mock either alias
// the aggregate as `total`, `debit`, `credit`, etc. and the source column is
// the obvious one. The tests seed values matching these names.
function sumForKey(_aliasKey: string, rows: Row[]): number {
  // Try common numeric fields in priority order.
  const candidates = ['amountPkr', 'netReceivedPkr', 'debitPkr', 'creditPkr', 'totalPkr'];
  let acc = 0;
  for (const r of rows) {
    for (const c of candidates) {
      if (c in r) {
        acc += Number(r[c] ?? 0);
        break;
      }
    }
  }
  return acc;
}

// ---------- insert / update / delete ----------

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

function applyDefaults(tableName: string, row: Row): Row {
  const out: Row = { ...row };
  if (out.id == null) out.id = nextId(tableName);
  if (out.createdAt == null) out.createdAt = new Date();
  if (out.updatedAt == null) out.updatedAt = new Date();
  return out;
}

interface InsertChain {
  values: (v: Row | Row[]) => InsertChain;
  returning: () => Promise<Row[]>;
  then: <T>(resolve: (v: undefined) => T, reject?: (e: unknown) => unknown) => Promise<T>;
}

function makeInsert(t: TableMeta): InsertChain {
  let inserted: Row[] = [];
  const chain: InsertChain = {
    values(v) {
      const list = Array.isArray(v) ? v : [v];
      const rows = list.map((row) => applyDefaults(t.name, row));
      tableRows(t.name).push(...rows);
      inserted = rows;
      return chain;
    },
    returning() {
      return Promise.resolve(inserted);
    },
    then(resolve, reject) {
      try {
        return Promise.resolve(resolve(undefined));
      } catch (e) {
        if (reject) return Promise.resolve(reject(e));
        return Promise.reject(e);
      }
    },
  };
  return chain;
}

interface UpdateChain {
  set: (patch: Row) => UpdateChain;
  where: (p?: Pred) => UpdateChain;
  returning: () => Promise<Row[]>;
  then: <T>(resolve: (v: undefined) => T, reject?: (e: unknown) => unknown) => Promise<T>;
}

function makeUpdate(t: TableMeta): UpdateChain {
  let patch: Row = {};
  let pred: Pred | undefined;
  let updatedRows: Row[] = [];
  const chain: UpdateChain = {
    set(p) {
      patch = p;
      return chain;
    },
    where(p) {
      pred = p;
      return chain;
    },
    returning() {
      const rows = tableRows(t.name);
      updatedRows = [];
      for (let i = 0; i < rows.length; i++) {
        if (evalPred(pred, rows[i]!)) {
          rows[i] = { ...rows[i], ...patch, updatedAt: new Date() };
          updatedRows.push(rows[i]!);
        }
      }
      return Promise.resolve(updatedRows);
    },
    then(resolve, reject) {
      try {
        const rows = tableRows(t.name);
        for (let i = 0; i < rows.length; i++) {
          if (evalPred(pred, rows[i]!)) {
            rows[i] = { ...rows[i], ...patch, updatedAt: new Date() };
          }
        }
        return Promise.resolve(resolve(undefined));
      } catch (e) {
        if (reject) return Promise.resolve(reject(e));
        return Promise.reject(e);
      }
    },
  };
  return chain;
}

interface DeleteChain {
  where: (p?: Pred) => Promise<void>;
}

function makeDelete(t: TableMeta): DeleteChain {
  return {
    where(p) {
      const rows = tableRows(t.name);
      const kept = rows.filter((r) => !evalPred(p, r));
      TABLES.set(t.name, kept);
      return Promise.resolve();
    },
  };
}

// ---------- exported db ----------

export const db = {
  select(projection?: Record<string, unknown>): SelectChain {
    return makeSelect(projection);
  },
  insert(t: TableMeta): InsertChain {
    if (!isTable(t)) throw new Error('insert(): not a table');
    return makeInsert(t);
  },
  update(t: TableMeta): UpdateChain {
    if (!isTable(t)) throw new Error('update(): not a table');
    return makeUpdate(t);
  },
  delete(t: TableMeta): DeleteChain {
    if (!isTable(t)) throw new Error('delete(): not a table');
    return makeDelete(t);
  },
};

// Also export the raw postgres client placeholder.
export const sql_client = null;

// ---------- table exports ----------

export const entities = makeTable('entities');
export const users = makeTable('users');
export const userEntityRoles = makeTable('userEntityRoles');
export const permissions = makeTable('permissions');
export const entitySettings = makeTable('entitySettings');

export const farms = makeTable('farms');
export const blocks = makeTable('blocks');
export const fields = makeTable('fields');
export const plots = makeTable('plots');
export const soilTests = makeTable('soilTests');
export const waterSources = makeTable('waterSources');
export const landTenureRecords = makeTable('landTenureRecords');
export const ndviObservations = makeTable('ndviObservations');

export const cropProfiles = makeTable('cropProfiles');
export const cropPlans = makeTable('cropPlans');
export const cropStageLogs = makeTable('cropStageLogs');
export const harvestRecords = makeTable('harvestRecords');
export const cropDiagnostics = makeTable('cropDiagnostics');

export const inputs = makeTable('inputs');
export const inputPurchases = makeTable('inputPurchases');
export const inputIssuances = makeTable('inputIssuances');
export const storageLocations = makeTable('storageLocations');
export const produceLots = makeTable('produceLots');
export const produceMovements = makeTable('produceMovements');

export const assets = makeTable('assets');
export const assetHourMeters = makeTable('assetHourMeters');
export const assetLogs = makeTable('assetLogs');

export const fuelStorageTanks = makeTable('fuelStorageTanks');
export const dieselPurchases = makeTable('dieselPurchases');
export const dieselDailyLogs = makeTable('dieselDailyLogs');
export const dieselStockReconciliations = makeTable('dieselStockReconciliations');

export const repairRequests = makeTable('repairRequests');
export const repairQuotes = makeTable('repairQuotes');
export const repairWorkOrders = makeTable('repairWorkOrders');
export const partsReplaced = makeTable('partsReplaced');

export const animals = makeTable('animals');
export const breedingEvents = makeTable('breedingEvents');
export const milkRecords = makeTable('milkRecords');
export const healthEvents = makeTable('healthEvents');
export const feedRecords = makeTable('feedRecords');

export const workers = makeTable('workers');
export const workerDocuments = makeTable('workerDocuments');
export const attendanceRecords = makeTable('attendanceRecords');
export const tasks = makeTable('tasks');
export const taskAssignments = makeTable('taskAssignments');
export const taskCompletions = makeTable('taskCompletions');
export const pieceRateLogs = makeTable('pieceRateLogs');
export const payrollRuns = makeTable('payrollRuns');
export const payslips = makeTable('payslips');
export const workerScorePeriods = makeTable('workerScorePeriods');
export const bonusRules = makeTable('bonusRules');

export const accounts = makeTable('accounts');
export const journalEntries = makeTable('journalEntries');
export const journalLines = makeTable('journalLines');
export const costAllocations = makeTable('costAllocations');
export const cashFlowForecasts = makeTable('cashFlowForecasts');

export const approvalWorkflows = makeTable('approvalWorkflows');
export const approvalRequests = makeTable('approvalRequests');
export const approvalActions = makeTable('approvalActions');
export const feasibilityStudies = makeTable('feasibilityStudies');
export const feasibilityAttachments = makeTable('feasibilityAttachments');
export const feasibilityComments = makeTable('feasibilityComments');

export const vendors = makeTable('vendors');
export const purchaseOrders = makeTable('purchaseOrders');
export const goodsReceivedNotes = makeTable('goodsReceivedNotes');
export const purchaseInvoices = makeTable('purchaseInvoices');

export const buyers = makeTable('buyers');
export const arhtis = makeTable('arhtis');
export const mandiDispatches = makeTable('mandiDispatches');
export const mandiSettlements = makeTable('mandiSettlements');
export const salesOrders = makeTable('salesOrders');
export const milkDispatches = makeTable('milkDispatches');
export const milkSettlements = makeTable('milkSettlements');

export const documents = makeTable('documents');
export const taxFilings = makeTable('taxFilings');
export const subsidyTransactions = makeTable('subsidyTransactions');
export const sprayDiaries = makeTable('sprayDiaries');

export const auditLog = makeTable('auditLog');
export const notifications = makeTable('notifications');
export const weatherRecords = makeTable('weatherRecords');
export const marketPrices = makeTable('marketPrices');
export const offlineSyncQueue = makeTable('offlineSyncQueue');

export const taskDependencies = makeTable('taskDependencies');
export const taskTimeEntries = makeTable('taskTimeEntries');
export const entityComments = makeTable('entityComments');
export const entityActivity = makeTable('entityActivity');
export const entityLabels = makeTable('entityLabels');
export const savedViews = makeTable('savedViews');
export const pushSubscriptions = makeTable('pushSubscriptions');
export const weatherAlertRules = makeTable('weatherAlertRules');
export const weatherAlerts = makeTable('weatherAlerts');

// ---------- test helpers ----------

export function resetDb(): void {
  TABLES.clear();
  idSeq = 0;
}

export interface SeedData {
  [tableName: string]: Row[];
}

/**
 * Bulk-seed multiple tables. Keys must match the exported table variable
 * names (e.g. `entities`, `cropPlans`). Rows are appended; ids are
 * preserved if present, otherwise auto-generated.
 */
export function seedDb(data: SeedData): void {
  for (const [key, rows] of Object.entries(data)) {
    for (const r of rows) {
      tableRows(key).push(applyDefaults(key, r));
    }
  }
}

/** Read raw rows for assertions. */
export function getRows(tableName: string): Row[] {
  return [...tableRows(tableName)];
}
