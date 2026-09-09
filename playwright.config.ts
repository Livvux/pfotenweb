import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", workers: 1, use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3110" }, reporter: "list" });
