/**
 * Integration-test helpers.
 * Spins up an ephemeral Postgres via @testcontainers/postgresql,
 * applies the supabase migrations, and exposes a connection string.
 *
 * Gated: file is only imported by *.int.test.ts which themselves only
 * run when RUN_INT_TESTS=1. Skip-if-no-docker is the caller's job.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

export interface PgFixture {
  container: StartedPostgreSqlContainer;
  url: string;
  sql: ReturnType<typeof postgres>;
}

export async function startPg(): Promise<PgFixture> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('zameen_test')
    .withUsername('zameen')
    .withPassword('zameen')
    .start();
  const url = container.getConnectionUri();
  const sql = postgres(url, { onnotice: () => undefined });

  // Run every .sql migration in order.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    await sql.unsafe(body);
  }

  return { container, url, sql };
}

export async function stopPg(fix: PgFixture): Promise<void> {
  await fix.sql.end();
  await fix.container.stop();
}
