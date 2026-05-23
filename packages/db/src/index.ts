import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

export const sql = postgres(url, { prepare: false });
export const db = drizzle(sql, { schema });
export * from './schema/index.js';
export * as schema from './schema/index.js';
export {
  trackQuery,
  executeTracked,
  sanitizeSql,
  listTopSlowQueriesToday,
  type TrackedQueryOptions,
  type SlowQueryRow,
} from './slow-query-tracker.js';
