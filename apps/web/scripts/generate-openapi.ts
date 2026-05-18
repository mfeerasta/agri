/**
 * Validates and re-emits apps/web/public/openapi.json. The spec is curated by
 * hand against the actual route handlers under apps/web/src/app/api/. Run with:
 *
 *   pnpm --filter @zameen/web exec tsx scripts/generate-openapi.ts
 *
 * The script does not invent endpoints. Edit the source JSON when routes change,
 * then run this to validate structure and round-trip format.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown> };
}

function main(): void {
  const specPath = resolve(process.cwd(), 'public/openapi.json');
  const raw = readFileSync(specPath, 'utf8');
  const doc = JSON.parse(raw) as OpenApiDoc;
  if (!doc.openapi.startsWith('3.')) {
    throw new Error('Expected OpenAPI 3.x');
  }
  const pathCount = Object.keys(doc.paths).length;
  if (pathCount === 0) throw new Error('Spec has no paths');
  for (const [path, methods] of Object.entries(doc.paths)) {
    if (!path.startsWith('/')) throw new Error(`Path must start with /: ${path}`);
    for (const method of Object.keys(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        throw new Error(`Unsupported method '${method}' on ${path}`);
      }
    }
  }
  writeFileSync(specPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  process.stdout.write(`openapi: ok (${pathCount} paths)\n`);
}

main();
