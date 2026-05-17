import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Root vitest config.
// Workspace-aware: discovers tests across packages and apps.
// Integration tests (*.int.test.ts) are excluded unless RUN_INT_TESTS=1.
const runInt = process.env.RUN_INT_TESTS === '1';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
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
      thresholds: {
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
  resolve: {
    alias: {
      '@zameen/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@zameen/approvals': path.resolve(__dirname, 'packages/approvals/src/index.ts'),
      '@zameen/finance': path.resolve(__dirname, 'packages/finance/src/index.ts'),
      '@zameen/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@zameen/db/types': path.resolve(__dirname, 'packages/db/src/types.ts'),
    },
  },
});
