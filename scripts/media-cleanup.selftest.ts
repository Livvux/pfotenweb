import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { tenants, tenantSettings, animals, animalImages, mediaDeletions } from "../src/db/schema";
import { saveFile } from "../src/lib/storage";

async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
  assert.equal(await db.$count(tenants), 0, "Fresh disposable database required");
  await db.insert(tenants).values({ id: 1 });
  await db.insert(tenantSettings).values({ tenantId: 1, orgName: "Testverein", shortName: "Test", heroHeadline: "Test" });
  try {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    await assert.rejects(saveFile(1, Buffer.from("not a png"), ".png"));
    const url = await saveFile(1, bytes, ".png");
    const file = path.join(process.env.UPLOAD_DIR!, url.slice("/uploads/".length));
    const [animal] = await db.insert(animals).values({ tenantId: 1, slug: "test", name: "Test", species: "hund", description: "Test" }).returning();
    await db.insert(animalImages).values({ tenantId: 1, animalId: animal.id, url });
    await db.update(tenantSettings).set({ logoUrl: url }).where(eq(tenantSettings.tenantId, 1));
    await db.delete(animals).where(eq(animals.id, animal.id));
    assert.equal(await db.$count(mediaDeletions), 1, "Intent committed even if app exits before unlink");
    const sweep = () => execFileSync(process.execPath, ["scripts/media-cleanup.mjs", "--once"], { env: process.env });
    sweep();
    assert.ok((await readFile(file)).length, "Shared logo survives removal of animal image");
    await db.update(tenantSettings).set({ logoUrl: null }).where(eq(tenantSettings.tenantId, 1));
    assert.equal(await db.$count(mediaDeletions), 1);
    sweep();
    await assert.rejects(readFile(file), { code: "ENOENT" });
    assert.equal(await db.$count(mediaDeletions), 0);
    await db.insert(mediaDeletions).values({ url });
    sweep();
    assert.equal(await db.$count(mediaDeletions), 0, "Retry of an already removed image is idempotent");
    console.log("Upload validation, durable deletion, shared references and retries: OK");
  } finally {
    await db.delete(tenants).where(eq(tenants.id, 1));
    await db.delete(mediaDeletions);
    await rm(path.join(process.env.UPLOAD_DIR!, "t1"), { recursive: true, force: true });
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
