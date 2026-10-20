// The page in Chromium: tests/web.spec.ts, against `npm run build` served by tests/web-server.ts.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && node tests/web-server.ts ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    stdout: 'ignore',
  },
});
