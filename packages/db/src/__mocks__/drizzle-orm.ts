/**
 * Re-export the predicate helpers from the centralized db mock so any
 * `import { eq, and, ... } from 'drizzle-orm'` resolves to the same builders
 * the mock db understands. Unit tests alias `drizzle-orm` to this file.
 */
export { eq, ne, and, or, inArray, gte, lte, isNull, desc, asc, sql } from './index.js';
