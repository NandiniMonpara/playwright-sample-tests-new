// @ts-check
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 0 : 0,
  workers: isCI ? 5 : 5,

  timeout: 60 * 1000,

  snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{arg}{-projectName}{-snapshotSuffix}{ext}',

  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never'
    }],
    ['blob', { outputDir: 'blob-report' }],
    ['json', { outputFile: './playwright-report/report.json' }],
    ['@testdino/playwright', {
      token: process.env.TESTDINO_TOKEN,
      debug: true,
      serverUrl: 'https://staging-api.testdino.com',
    }],
  ],

  use: {
    baseURL: 'https://storedemo.testdino.com/',
    headless: true,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@chromium/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: /@firefox/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: /@webkit/,
    },
    {
      name: 'android',
      use: { ...devices['Pixel 5'] },
      grep: /@android/,
    },
    {
      name: 'ios',
      use: { ...devices['iPhone 12'] },
      grep: /@ios/,
    },
    {
      name: 'api',
      use: { ...devices['API'] },
      grep: /@api/,
    },
  ],
});
