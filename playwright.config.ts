import { defineConfig, devices } from '@playwright/test';

// Three projects: web (3000), field (3001), approve (3003).
// Each project pins its own baseURL; tests use baseURL-relative paths
// and rely on Playwright's auto-waiting selectors.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
      },
      testMatch: /supervisor-approve\.spec\.ts|field-pl-report\.spec\.ts/,
    },
    {
      name: 'field',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.E2E_FIELD_URL ?? 'http://localhost:3001',
      },
      testMatch: /diesel-log\.spec\.ts|harvest-inventory\.spec\.ts/,
    },
    {
      name: 'approve',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.E2E_APPROVE_URL ?? 'http://localhost:3003',
      },
      testMatch: /director-approval\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_WEB_URL
    ? undefined
    : [
        {
          command: 'pnpm --filter @zameen/web dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @zameen/field dev',
          url: 'http://localhost:3001',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @zameen/approve dev',
          url: 'http://localhost:3003',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
