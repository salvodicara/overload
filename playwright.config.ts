import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5199',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'pnpm run dev:e2e',
    port: 5199,
    reuseExistingServer: true,
  },
});
