import { defineConfig, devices } from "@playwright/test";
import { flowVideo } from "./e2e/flows/video";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://admin.localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testIgnore: "flows/**", use: { ...devices["Desktop Chrome"] } },
    // Mỗi flow một video để chủ dự án xem duyệt; bước chậm 300 ms cho kịp nhìn.
    {
      name: "flows",
      testDir: "./e2e/flows",
      timeout: 300_000,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 }, video: flowVideo(1366, 768), launchOptions: { slowMo: 300 } },
    },
  ],
  webServer: { command: "bun dev", url: "http://admin.localhost:3100/login", reuseExistingServer: true, timeout: 120_000 },
});
