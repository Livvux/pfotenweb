import { defineConfig } from "@playwright/test";
if (!/^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//.test(process.env.DATABASE_URL ?? "") || !/^\/tmp\//.test(process.env.UPLOAD_DIR ?? "")) throw new Error("E2E benötigt eine Wegwerf-Datenbank auf 127.0.0.1:55439 und UPLOAD_DIR unter /tmp.");
export default defineConfig({ testDir: "./e2e", workers: 1, use: { ignoreHTTPSErrors: true, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3110" }, reporter: "list" });
