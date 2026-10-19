import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { animals, animalImages, tenants, tenantSettings } from "../src/db/schema";
import { animalByPublicId, animalPdfData, pdfImage } from "../src/lib/animal-downloads";
import { renderAnimalPdf } from "../src/lib/animal-pdf";
import { publicAnimalFacts } from "../src/lib/public-animal-facts";
import { scopeOf } from "../src/lib/tenant";
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
  assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
  assert.equal(await db.$count(tenants), 0);
  const scope = scopeOf(1);
  await db.insert(tenants).values({ id: 1 });
  try {
    const [settings] = await db.insert(tenantSettings).values({ tenantId: 1, orgName: "QA Verein", shortName: "QA", heroHeadline: "QA" }).returning();
    const [animal] = await db.insert(animals).values({ tenantId: 1, name: "Fiktiver QA Hund", slug: "qa-hund", species: "hund", description: "Fiktiver Steckbrief für den Test.", birthYear: 2020, profile: { age: "ungefähre Altersangabe", health: "Keine erfundenen Angaben", housing: "haus" } }).returning();
    const imageDir = path.join(process.env.UPLOAD_DIR!, "t1"); await mkdir(imageDir, { recursive: true });
    await writeFile(path.join(imageDir, "qa-document.png"), await sharp({ create: { width: 12, height: 12, channels: 3, background: "green" } }).png().toBuffer());
    await db.insert(animalImages).values({ tenantId: 1, animalId: animal.id, url: "/uploads/t1/qa-document.png" });
    assert.equal(await pdfImage(scope, "https://example.org/image.png"), undefined);
    assert.equal(await pdfImage(scope, "/uploads/t2/qa-document.png"), undefined);
    assert.equal(await pdfImage(scope, "/uploads/t1/../../secret.png"), undefined);
    const data = await animalPdfData(scope, settings, animal.id); assert.ok(data); assert.ok(data.photo);
    assert.deepEqual(data.facts, publicAnimalFacts(animal, animal.profile));
    assert.ok(data.url.endsWith(`/tier/${animal.publicId}`)); assert.match(data.qr, /^data:image\/png;base64,/);
    assert.equal((await renderAnimalPdf([data])).subarray(0, 5).toString(), "%PDF-");
    await db.update(animals).set({ slug: "neuer-name" }).where(eq(animals.id, animal.id));
    assert.equal((await animalByPublicId(scope, animal.publicId))?.slug, "neuer-name");
    await db.delete(animals).where(eq(animals.id, animal.id));
    assert.equal(await animalByPublicId(scope, animal.publicId), null);
    console.log("PDF/QR, shared public facts, local-only images and stable slug-independent identity: OK");
  } finally { await db.delete(tenants).where(eq(tenants.id, 1)); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
