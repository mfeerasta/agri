import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Root vitest config.
// Two workspaces: `unit` (the default; aliases @zameen/db + drizzle-orm to an
// in-memory mock so no Postgres is needed) and `int` (uses real @zameen/db
// against a Testcontainers Postgres — only runs when RUN_INT_TESTS=1).
const runInt = process.env.RUN_INT_TESTS === '1';

const mockDbPath = path.resolve(__dirname, 'packages/db/src/__mocks__/index.ts');
const mockOrmPath = path.resolve(__dirname, 'packages/db/src/__mocks__/drizzle-orm.ts');

const sharedAliases = {
  '@zameen/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
  '@zameen/approvals': path.resolve(__dirname, 'packages/approvals/src/index.ts'),
  '@zameen/finance': path.resolve(__dirname, 'packages/finance/src/index.ts'),
  '@zameen/locale': path.resolve(__dirname, 'packages/locale/src/index.ts'),
};

export default defineConfig({
  resolve: {
    alias: {
      ...sharedAliases,
      '@zameen/db': runInt ? path.resolve(__dirname, 'packages/db/src/index.ts') : mockDbPath,
      '@zameen/db/types': path.resolve(__dirname, 'packages/db/src/types.ts'),
      ...(runInt ? {} : { 'drizzle-orm': mockOrmPath }),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: runInt
      ? ['packages/**/__tests__/integration/**/*.test.ts', 'packages/**/*.int.test.ts']
      : [
          'packages/**/src/**/__tests__/**/*.test.ts',
          'packages/**/src/**/*.test.ts',
        ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      'e2e/**',
      ...(runInt ? [] : ['**/__tests__/integration/**', '**/*.int.test.ts']),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/approvals/src/**', 'packages/finance/src/**'],
      exclude: ['**/__tests__/**', '**/*.d.ts', '**/index.ts'],
      thresholds: runInt
        ? undefined
        : {
            'packages/approvals/src/**': {
              lines: 80,
              functions: 80,
              branches: 80,
              statements: 80,
            },
            'packages/finance/src/**': {
              lines: 80,
              functions: 80,
              branches: 80,
              statements: 80,
            },
          },
    },
  },
});
