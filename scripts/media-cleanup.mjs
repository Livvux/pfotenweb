import postgres from "postgres";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const root = process.env.UPLOAD_DIR;
if (!root || !path.isAbsolute(root)) throw new Error("UPLOAD_DIR must be absolute");
let stopped = false;
process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
async function sweep() {
  await sql`delete from sessions where expires_at < now()`;
  await sql`delete from auth_verifications where expires_at < now() - interval '1 day'`;
  await sql`delete from security_challenges where expires_at < now() - interval '1 day'`;
  await sql`update association_settings set website_media = coalesce((select jsonb_agg(image) from jsonb_array_elements(website_media) image where (image->>'createdAt')::timestamptz > now() - interval '24 hours'), '[]'::jsonb) where jsonb_array_length(website_media) > 0`;
  const jobs = await sql`select url from media_deletions order by created_at limit 100`;
  for (const { url } of jobs) {
    try {
      await sql.begin(async tx => {
        await tx`select id from association where id = 1 for update`;
        const [job] = await tx`select url from media_deletions where url = ${url} for update`;
        if (!job) return;
        const [reference] = await tx`select media_referenced(${url}) as used`;
        if (!reference.used && /^\/uploads\/t1\/(?:import_)?[a-f0-9]{24}\.(jpg|png|webp)$/.test(url)) {
          try { await unlink(path.join(root, url.slice("/uploads/".length))); }
          catch (error) { if (error.code !== "ENOENT") throw error; }
        }
        await tx`delete from media_deletions where url = ${url}`;
      });
    } catch {
      await sql`update media_deletions set attempts = attempts + 1 where url = ${url}`;
      console.error("Media cleanup failed; intent retained");
    }
  }
}
try {
  do { await sweep(); if (!process.argv.includes("--once") && !stopped) await setTimeout(5000); }
  while (!stopped && !process.argv.includes("--once"));
} finally { await sql.end(); }
