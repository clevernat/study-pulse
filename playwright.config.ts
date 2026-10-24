import { defineConfig, devices } from "@playwright/test";

// Run with `npm run test:e2e`. That script builds the app, starts the Firebase
// emulators (project demo-studypulse, no real cloud) and then runs these tests.
// The app is the production build (`npm run build:e2e`) served by the
// Firebase Hosting emulator, so rewrites, headers and the service worker
// behave like the live site.
const PORT = 5050;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "docs/evidence/playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
});
