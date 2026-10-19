import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { tenants, tenantSettings, users, mediaDeletions } from "../src/db/schema";
import { credentialHash, createCredentialUser } from "../src/lib/auth-users";
import { createDataExport } from "../src/lib/data-export";
import { importData } from "../src/lib/data-import";
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
  assert.equal(await db.$count(tenants), 0);
  const stage = await mkdtemp(path.join(tmpdir(), "profiles-selftest-"));
  process.env.IMPORT_ARCHIVE_DIR = path.join(stage, "originals");
  async function prepare() {
    await db.delete(tenants).where(eq(tenants.id, 1));
    await db.insert(tenants).values({ id: 1 });
    await db.insert(tenantSettings).values({ tenantId: 1, orgName: "QA", shortName: "QA", heroHeadline: "QA" });
    return db.transaction(tx => createCredentialUser(tx, { tenantId: 1, username: "profile-owner", role: "owner", password: "QA original credential" }));
  }
  try {
    const user = await prepare();
    const dir = path.join(process.env.UPLOAD_DIR!, "t1");
    await mkdir(dir, { recursive: true });
    const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#445566" } }).png().toBuffer();
    const originalImage = "/uploads/t1/123456789012345678901234.png";
    await writeFile(path.join(dir, path.basename(originalImage)), image);
    await db.update(users).set({ displayName: "QA Name", profileRole: "Pflegestelle", bio: "Nur fiktive Angaben.", profileImage: originalImage }).where(eq(users.id, user.id));
    const referenced = await db.execute(sql`select media_referenced(${originalImage}) as referenced`);
    assert.equal(referenced[0].referenced, true);
    const archive = await createDataExport(1);
    try {
      const target = await prepare();
      const originalCredential = await credentialHash(target.id);
      await importData(archive.file, 1);
      const [profile] = await db.select().from(users).where(eq(users.id, target.id));
      assert.equal(profile.displayName, "QA Name");
      assert.equal(profile.profileRole, "Pflegestelle");
      assert.equal(profile.role, "owner");
      assert.deepEqual(profile.permissions, []);
      assert.equal(await credentialHash(target.id), originalCredential, "Import must preserve the destination credential");
      assert.equal(profile.emailVerified, false, "No source security address is activated");
      assert.ok(profile.profileImage);
      assert.deepEqual(await readFile(path.join(process.env.UPLOAD_DIR!, profile.profileImage.replace("/uploads/", ""))), image);
      await db.update(users).set({ profileImage: null }).where(eq(users.id, target.id));
      assert.equal(await db.$count(mediaDeletions, eq(mediaDeletions.url, profile.profileImage)), 1);
      await db.delete(tenants).where(eq(tenants.id, 1));
      await db.insert(tenants).values({ id: 1 });
      await db.insert(tenantSettings).values({ tenantId: 1, orgName: "QA", shortName: "QA", heroHeadline: "QA" });
      const unmatched = await importData(archive.file, 1);
      assert.ok(unmatched.additional.includes("profiles (nicht vorhandene Konten)"));
      assert.ok(unmatched.sourceArchive);
      assert.equal(await db.$count(users), 0, "Profiles never create accounts");
    } finally { await archive.cleanup(); }
    console.log("Private profile references, existing-account roundtrip, deletion intent and unmatched archive preservation: OK");
  } finally { await db.delete(tenants).where(eq(tenants.id, 1)); await rm(stage, { recursive: true, force: true }); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
