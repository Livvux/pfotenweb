import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  assert.match(process.env.DATABASE_URL ?? "", /127\.0\.0\.1:55439\//);
  assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
  const stage = await mkdtemp(path.join(tmpdir(), "import-selftest-"));
  const archiveRoot = process.env.IMPORT_ARCHIVE_DIR;
  process.env.IMPORT_ARCHIVE_DIR = path.join(stage, "private");
  assert.equal(await db.$count(tenants), 0, "Use a fresh disposable database before setup");
  const ids = [1, 1, 1];
  const prepare = async () => {
    await db.delete(tenants).where(eq(tenants.id, 1));
    await rm(path.join(process.env.UPLOAD_DIR!, "t1"), { recursive: true, force: true });
    await db.insert(tenants).values({ id: 1 });
    await db.insert(tenantSettings).values({ tenantId: 1, orgName: "Testverein", shortName: "Test", heroHeadline: "Tiere" });
  };
  try {
    await prepare();
    const dir = path.join(process.env.UPLOAD_DIR!, `t${ids[0]}`);
    await mkdir(dir, { recursive: true });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=", "base64");
    await writeFile(path.join(dir, "photo.png"), png);
    const [animal] = await db.insert(animals).values({ tenantId: ids[0], slug: "balou", name: "Balou", species: "hund", description: "Beschreibung", birthYear: 2020 }).returning();
    await db.insert(animalImages).values({ tenantId: ids[0], animalId: animal.id, url: `/uploads/t${ids[0]}/photo.png` });
    await db.insert(posts).values({ tenantId: ids[0], slug: "neu", title: "Neu", body: "Beitrag" });
    await db.insert(inquiries).values({ tenantId: ids[0], animalId: animal.id, name: "Test", email: "test@example.invalid", message: "Anfrage" });
    const archive = await createDataExport(ids[0]);
    try {
      await prepare();
      const native = await importData(archive.file, ids[1]);
      assert.deepEqual(native, { additional: [], sourceArchive: null });
      await extract({ file: archive.file, cwd: stage });
    } finally { await archive.cleanup(); }
    const manifestPath = path.join(stage, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.version = 14;
    manifest.inquiries[0].phone = "0123456789";
    manifest.animalProfiles = [{ animalId: animal.id, profile: { health: "gesund" } }];
    const extra = Buffer.from("additional document fixture");
    const digest = createHash("sha256").update(extra).digest("hex");
    await writeFile(path.join(stage, "images", `${digest}.pdf`), extra);
    manifest.files.push({ name: `${digest}.pdf`, bytes: extra.length, sha256: digest });
    await writeFile(manifestPath, JSON.stringify(manifest));
    const source = path.join(stage, "source.tar.gz");
    await create({ cwd: stage, file: source, gzip: true }, ["manifest.json", "images"]);
    assert.throws(() => compatibleImport({ ...manifest, version: 15 }));
    await prepare();
    process.env.IMPORT_ARCHIVE_DIR = process.env.UPLOAD_DIR;
    await assert.rejects(importData(source, ids[2]), /außerhalb/);
    assert.equal(await db.$count(animals, eq(animals.tenantId, ids[2])), 0);
    process.env.IMPORT_ARCHIVE_DIR = path.join(stage, "private");
    const result = await importData(source, ids[2]);
    assert.ok(result.additional.includes("inquiries.phone"));
    assert.ok(result.additional.includes("animalProfiles"));
    assert.ok(result.additional.includes("files (zusätzliche Medien)"));
    assert.ok(result.sourceArchive);
    assert.deepEqual(await readFile(result.sourceArchive), await readFile(source), "Entire original archive remains byte-identical");
    const [imported] = await db.select().from(animals).where(eq(animals.tenantId, ids[2]));
    assert.equal(imported.name, "Balou"); assert.equal(imported.birthYear, 2020);
    const [image] = await db.select().from(animalImages).where(eq(animalImages.tenantId, ids[2]));
    assert.equal(image.animalId, imported.id);
    assert.deepEqual(await readFile(path.join(process.env.UPLOAD_DIR!, image.url.replace("/uploads/", ""))), png);
    assert.equal(await db.$count(posts, eq(posts.tenantId, ids[2])), 1);
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.tenantId, ids[2]));
    assert.equal(inquiry.message, "Anfrage"); assert.equal(inquiry.animalId, imported.id);
    await assert.rejects(importData(source, ids[2]), /leere Installation/);
    // Every extra file is verified too, even when it is only retained in the source archive.
    await writeFile(path.join(stage, "images", `${digest}.pdf`), "corrupt");
    await create({ cwd: stage, file: source, gzip: true }, ["manifest.json", "images"]);
    await assert.rejects(importData(source, ids[2]), /Prüfsumme/);
    console.log("Import: native and v14 compatibility, common data/media/relations, explicit extras, exact private archive, unknown version, corrupted extras and nonempty target checks passed.");
  } finally {
    process.env.IMPORT_ARCHIVE_DIR = archiveRoot;
    for (const id of ids) {
      await db.delete(tenants).where(eq(tenants.id, id));
      await rm(path.join(process.env.UPLOAD_DIR!, `t${id}`), { recursive: true, force: true });
    }
    await rm(stage, { recursive: true, force: true });
  }
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
