import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? 'chrome' : undefined,
    viewport: { width: 1440, height: 1080 },
  },
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: !process.env.CI },
});
