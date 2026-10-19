import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'bun run build && bun run preview', port: 4173, reuseExistingServer: true, timeout: 180_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
});
