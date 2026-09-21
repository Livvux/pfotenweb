import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { create, extract } from "tar";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { tenants, tenantSettings, animals, animalImages, posts, inquiries } from "../src/db/schema";
import { createDataExport } from "../src/lib/data-export";
import { importData } from "../src/lib/data-import";
import { compatibleImport } from "../src/lib/import-compatibility";

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(database.hostname, "127.0.0.1");
  assert.equal(database.port, "55439");
  assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
  assert.equal(await db.$count(tenants), 0, "Use a fresh disposable database before setup");
  const stage = await mkdtemp(path.join(tmpdir(), "import-selftest-"));
  const archiveRoot = process.env.IMPORT_ARCHIVE_DIR;
  const privateRoot = path.join(stage, "private");
  process.env.IMPORT_ARCHIVE_DIR = privateRoot;
  const tenantId = 1;
  const prepare = async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await rm(path.join(process.env.UPLOAD_DIR!, "t1"), { recursive: true, force: true });
    await db.insert(tenants).values({ id: tenantId });
    await db.insert(tenantSettings).values({ tenantId, orgName: "Testverein", shortName: "Test", heroHeadline: "Tiere" });
  };
  try {
    await prepare();
    const dir = path.join(process.env.UPLOAD_DIR!, "t1");
    await mkdir(dir, { recursive: true });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=", "base64");
    await writeFile(path.join(dir, "photo.png"), png);
    const [animal] = await db.insert(animals).values({ tenantId, slug: "balou", name: "Balou", species: "hund", description: "Beschreibung", birthYear: 2020 }).returning();
    await db.insert(animalImages).values({ tenantId, animalId: animal.id, url: "/uploads/t1/photo.png" });
    await db.insert(posts).values({ tenantId, slug: "neu", title: "Neu", body: "Beitrag" });
    await db.insert(inquiries).values({ tenantId, animalId: animal.id, name: "Test", email: "test@example.invalid", message: "Anfrage" });
    const archive = await createDataExport(tenantId);
    try {
      await prepare();
      assert.deepEqual(await importData(archive.file, tenantId), { additional: [], sourceArchive: null });
      await extract({ file: archive.file, cwd: stage });
    } finally { await archive.cleanup(); }
    const manifestPath = path.join(stage, "manifest.json");
    const original = JSON.parse(await readFile(manifestPath, "utf8"));
    const extra = Buffer.from("additional document fixture");
    const digest = createHash("sha256").update(extra).digest("hex");
    await writeFile(path.join(stage, "images", `${digest}.pdf`), extra);
    const source = path.join(stage, "source.tar.gz");

    for (const version of [14, 15]) {
      const manifest = structuredClone(original);
      manifest.version = version;
      manifest.inquiries[0].phone = "0123456789";
      manifest.animalProfiles = [{ animalId: animal.id, profile: { health: "gesund" } }];
      manifest.files.push({ name: `${digest}.pdf`, bytes: extra.length, sha256: digest });
      if (version === 15) {
        // Opaque, synthetic archive-only sections: no review implementation or
        // credentials are imported and no email/notification can be replayed.
        manifest.reviewSettings = { enabled: true, delayDays: 30, showHero: true };
        manifest.adoptionReviews = [{ title: "Synthetische Rückmeldung", rating: 5 }];
        manifest.reviewMedia = [];
      }
      const before = JSON.stringify(manifest);
      const projected = compatibleImport(manifest);
      assert.equal(JSON.stringify(manifest), before, "Projection must not mutate the source");
      assert.equal(projected.data.version, 1);
      assert.equal("adoptionReviews" in projected.data, false);
      for (const badVersion of [0, 16, 1.5, "15"]) {
        assert.throws(() => compatibleImport({ ...manifest, version: badVersion }));
      }
      await writeFile(manifestPath, JSON.stringify(manifest));
      await create({ cwd: stage, file: source, gzip: true }, ["manifest.json", "images"]);
      await prepare();
      process.env.IMPORT_ARCHIVE_DIR = process.env.UPLOAD_DIR;
      await assert.rejects(importData(source, tenantId), /außerhalb/);
      assert.equal(await db.$count(animals, eq(animals.tenantId, tenantId)), 0);
      process.env.IMPORT_ARCHIVE_DIR = privateRoot;
      const result = await importData(source, tenantId);
      for (const field of ["inquiries.phone", "animalProfiles", "files (zusätzliche Medien)", ...(version === 15 ? ["reviewSettings", "adoptionReviews", "reviewMedia"] : [])]) {
        assert.ok(result.additional.includes(field), field);
      }
      assert.ok(result.sourceArchive);
      assert.deepEqual(await readFile(result.sourceArchive), await readFile(source), "Entire original archive remains byte-identical");
      assert.equal((await stat(result.sourceArchive)).mode & 0o777, 0o600);
      const [imported] = await db.select().from(animals).where(eq(animals.tenantId, tenantId));
      assert.equal(imported.name, "Balou"); assert.equal(imported.birthYear, 2020);
      const [image] = await db.select().from(animalImages).where(eq(animalImages.tenantId, tenantId));
      assert.equal(image.animalId, imported.id);
      assert.deepEqual(await readFile(path.join(process.env.UPLOAD_DIR!, image.url.replace("/uploads/", ""))), png);
      assert.equal(await db.$count(posts, eq(posts.tenantId, tenantId)), 1);
      const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.tenantId, tenantId));
      assert.equal(inquiry.message, "Anfrage"); assert.equal(inquiry.animalId, imported.id);
      assert.equal((await readdir(path.join(process.env.UPLOAD_DIR!, "t1"))).length, 1, "Extra media must not enter public uploads");
      const retained = (await readdir(privateRoot)).sort();
      await assert.rejects(importData(source, tenantId), /leere Installation/);
      assert.deepEqual((await readdir(privateRoot)).sort(), retained, "Failed import cleans only its own archive");
      // Every extra file is verified, even when only retained in the source archive.
      await writeFile(path.join(stage, "images", `${digest}.pdf`), "corrupt");
      await create({ cwd: stage, file: source, gzip: true }, ["manifest.json", "images"]);
      await assert.rejects(importData(source, tenantId), /Prüfsumme/);
      assert.deepEqual((await readdir(privateRoot)).sort(), retained);
      await writeFile(path.join(stage, "images", `${digest}.pdf`), extra);
    }
    console.log("Import: native/v14/v15, common data/media/relations, explicit extras, byte-identical private archives, permissions, projection purity, unknown versions, corrupted extras and nonempty targets passed.");
  } finally {
    if (archiveRoot === undefined) delete process.env.IMPORT_ARCHIVE_DIR;
    else process.env.IMPORT_ARCHIVE_DIR = archiveRoot;
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await rm(path.join(process.env.UPLOAD_DIR!, "t1"), { recursive: true, force: true });
    await rm(stage, { recursive: true, force: true });
  }
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
