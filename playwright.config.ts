import { defineConfig, devices } from '@playwright/test';

// Four web servers (web 3000, field 3001, ops 3002, approve 3003) but only
// three Playwright projects since ops is exercised indirectly. E2E_SEQUENTIAL=1
// forces serial execution; CI uses staging URLs and skips webServer bootstrap.
const isCi = !!process.env.CI;
const sequential = process.env.E2E_SEQUENTIAL === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !sequential,
  workers: sequential ? 1 : isCi ? 2 : undefined,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
      },
      testMatch:
        /specs\/(00-smoke|03-supervisor|04-farm-manager|07-harvest|08-field-pnl|10-feasibility|11-csv|12-automation|14-export|15-rls).*\.spec\.ts/,
    },
    {
      name: 'field',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.E2E_FIELD_URL ?? 'http://localhost:3001',
      },
      testMatch: /specs\/(01-worker|02-worker|09-offline|13-receipt).*\.spec\.ts/,
    },
    {
      name: 'approve',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.E2E_APPROVE_URL ?? 'http://localhost:3003',
      },
      testMatch: /specs\/(05-director|06-repair).*\.spec\.ts/,
    },
  ],
  webServer: isCi
    ? undefined
    : [
        {
          command: 'pnpm --filter @zameen/web dev',
          port: 3000,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @zameen/field dev',
          port: 3001,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @zameen/ops dev',
          port: 3002,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @zameen/approve dev',
          port: 3003,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
