import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '../../tests/browser',
  outputDir: '../../test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: {timeout: 10000},
  use: {
    baseURL: 'http://localhost:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node ../../tests/helpers/browser-server.mjs',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: false,
    timeout: 90000
  }
});
