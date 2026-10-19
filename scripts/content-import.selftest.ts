import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { animals, contentImportImages, tenants, tenantSettings, users } from "../src/db/schema";
import { createCredentialUser } from "../src/lib/auth-users";
import { scopeOf } from "../src/lib/tenant";
import { createImport, runImports, getImport, saveCandidate, approveImport, uploadImportImage, cancelImport, setMapping } from "../src/lib/content-import/service";
import { mapRow, parseSource, plainText, suggestMapping } from "../src/lib/content-import/parser";
import { MAX_SOURCE_BYTES } from "../src/lib/content-import/types";
import { downloadImage, imageUrl, publicAddress } from "../src/lib/content-import/download";
import { putMedia, readMedia } from "../src/lib/content-import/storage";
export const wxr = `<?xml version="1.0"?><rss xmlns:w="http://wordpress.org/export/1.2/" xmlns:c="http://purl.org/rss/1.0/modules/content/"><channel><link>https://old.example</link><w:wxr_version>1.2</w:wxr_version>
<item><title>Hund Sam</title><w:post_id>1</w:post_id><w:post_type>haustier</w:post_type><c:encoded><![CDATA[<p>Sam sucht ein ruhiges Zuhause.</p><p>Er liebt Spaziergänge.</p>[gallery ids="3"]]]></c:encoded><w:postmeta><w:meta_key>art</w:meta_key><w:meta_value>hund</w:meta_value></w:postmeta><w:postmeta><w:meta_key>_thumbnail_id</w:meta_key><w:meta_value>3</w:meta_value></w:postmeta></item>
<item><title>Verein</title><w:post_id>2</w:post_id><w:post_type>page</w:post_type><c:encoded><![CDATA[Wir helfen Tieren auf dem Weg in ein neues Zuhause.]]></c:encoded></item>
<item><title>Bild</title><w:post_id>3</w:post_id><w:post_type>attachment</w:post_type><w:post_parent>1</w:post_parent><w:attachment_url>https://old.example/sam.jpg</w:attachment_url></item>
</channel></rss>`;
async function parserTests() {
  const csv = '\ufeffid;name;beschreibung;tierart\n1;"Sam; Senior";"Ein freundlicher Hund.\nEr liebt Menschen und Spaziergänge.";hund';
  const parsed = parseSource(csv, "csv"); assert.equal(parsed.rows.length, 1); assert.match(parsed.rows[0].fields.beschreibung, /\nEr/);
  assert.equal(parseSource('id,title,body\n1,"Tag, eins","Ein langer Text mit ""Zitat""."', "csv").rows[0].fields.title, "Tag, eins");
  for (const bad of ['id,title\n1,2,3', 'id,id\n1,2', 'id,title\n1,"offen']) assert.throws(() => parseSource(bad, "csv"));
  assert.throws(() => parseSource("x".repeat(MAX_SOURCE_BYTES + 1), "csv"));
  assert.throws(() => parseSource("id,title\n" + Array.from({ length: 1001 }, (_, i) => `${i},Test`).join("\n"), "csv"));
  const xml = parseSource(wxr, "wordpress"); assert.equal(xml.rows.length, 2); assert.equal(xml.rows[0].fields["meta:art"], "hund"); assert.equal(xml.rows[0].images.length, 1);
  const mapped = mapRow(xml.rows[0], { ...suggestMapping(Object.keys(xml.rows[0].fields)), columns: { ...suggestMapping(Object.keys(xml.rows[0].fields)).columns, species: "meta:art" } }, "wordpress");
  assert.equal(mapped.draft.kind, "skip"); assert.equal(mapped.draft.species, "hund"); assert.match(mapped.draft.body, /\n\n/); assert(mapped.warnings.length > 0);
  for (const bad of [wxr.slice(0, -20), '<!DOCTYPE rss [<!ENTITY a SYSTEM "file:///etc/passwd">]>'+wxr, '<rss><channel /></rss>']) assert.throws(() => parseSource(bad, "wordpress"));
  assert.equal(plainText('<p>Hallo &amp; Welt</p><script>alert(1)</script><iframe src="x">falsch</iframe><p>Ende</p>').text, "Hallo & Welt\n\nEnde");
  console.log("Parser: CSV, WXR, Metafelder, HTML und Grenzen OK");
}
async function networkTests(png: Buffer) {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "192.0.2.1"]) assert.equal(publicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "2606:4700:4700::1111"]) assert.equal(publicAddress(ip), true);
  for (const url of ["file:///a", "http://user:pw@example.org/a", "http://localhost/a", "https://example.org:123/a"]) assert.throws(() => imageUrl(url));
  let resolved = 0; let readCount = 0;
  const resolve = async () => { resolved++; return [{ address: "8.8.8.8", family: 4 }]; };
  const image = await downloadImage("https://old.example/a", { resolve, read: async (_url, pinned) => { assert.equal(pinned.address, "8.8.8.8"); readCount++; return png; } });
  assert.equal(image.ext, ".png"); assert.equal(resolved, 1); assert.equal(readCount, 1);
  await assert.rejects(downloadImage("https://old.example/a", { resolve: async () => [{ address: "127.0.0.1", family: 4 }], read: async () => { throw new Error("must not connect"); } }), /öffentliche/);
  let dns = 0;
  await assert.rejects(downloadImage("https://old.example/a", { resolve: async () => [{ address: ++dns === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 }], read: async () => "https://old.example/redirect" }), /öffentliche/);
  await assert.rejects(downloadImage("https://old.example/a", { resolve, read: async () => "https://old.example/redirect" }), /oft/);
  await assert.rejects(downloadImage("https://old.example/a", { resolve, read: async () => Buffer.from("html") }), /kein JPEG/);
  await assert.rejects(downloadImage("https://old.example/a", { resolve, read: async () => Buffer.alloc(5 * 1024 * 1024 + 1) }), /5 MB/);
  const keepAlive = setTimeout(() => {}, 100);
  await assert.rejects(downloadImage("https://old.example/a", { resolve: async () => new Promise(() => {}), timeout: 5 }), /lange/); clearTimeout(keepAlive);
  console.log("Netzwerk: IP-Sperren, DNS-Pinning, Redirects, Timeout und Bildgrenzen OK");
}

async function main() {
 assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:55439\//);
 assert.match(process.env.UPLOAD_DIR ?? "", /^\/tmp\//);
 assert.equal(await db.$count(tenants), 0);
 await parserTests();
 const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#338844" } }).png().toBuffer();
 await networkTests(png);
 await db.insert(tenants).values({ id: 1 });
 await db.insert(tenantSettings).values({ tenantId: 1, orgName: "QA", shortName: "QA", heroHeadline: "QA" });
 const scope = scopeOf(1);
 try {
  const owner = await db.transaction(tx => createCredentialUser(tx, { tenantId: 1, username: "import-owner", role: "owner", password: "QA owner password" }));
  const editor = await db.transaction(tx => createCredentialUser(tx, { tenantId: 1, username: "import-editor", role: "editor", password: "QA editor password" }));
  const csv = 'id;name;beschreibung;tierart\n1;Sam;Sam ist ein freundlicher Hund und sucht ein Zuhause.;hund';
  await assert.rejects(createImport(scope, editor.id, csv, "csv", "qa.csv", "old.example"), /Verantwortliche/);
  const id = await createImport(scope, owner.id, csv, "csv", "qa.csv", "old.example");
  await Promise.all([runImports(), runImports()]);
  let view = (await getImport(scope, id))!; assert.equal(view.state, "review");
  const candidate = view.candidates[0];
  await uploadImportImage(scope, owner.id, candidate.id, null, png);
  await assert.rejects(uploadImportImage(scope, owner.id, candidate.id, null, Buffer.from([137,80,78,71,13,10,26,10])), /Bild|dekodier|beschädigt/);
  const [photo] = await db.select().from(contentImportImages).where(eq(contentImportImages.candidateId, candidate.id));
  assert.ok(photo.targetKey); assert.ok(photo.stageKey);
  await putMedia(photo.targetKey, png, "image/png");
  await db.execute(sql`create function qa_fail_import_insert() returns trigger language plpgsql as $$ begin raise exception 'QA deliberate mapping failure'; end $$`);
  await db.execute(sql`create trigger qa_fail_import_insert before insert on content_import_candidates for each row execute function qa_fail_import_insert()`);
  try { await assert.rejects(setMapping(scope, owner.id, id, (await getImport(scope, id))!.mapping!), /QA deliberate|Failed query/); }
  finally { await db.execute(sql`drop trigger qa_fail_import_insert on content_import_candidates`); await db.execute(sql`drop function qa_fail_import_insert()`); }
  assert.ok((await readMedia(photo.stageKey)).length, "Rollback preserves previously prepared image bytes");
  view = (await getImport(scope, id))!;
  // Remove the failed replacement candidate explicitly, as the UI requires.
  for (const image of view.candidates[0].images.filter(image => image.state !== "ready")) await db.delete(contentImportImages).where(eq(contentImportImages.id, image.id));
  await approveImport(scope, owner.id, id, true, (await getImport(scope, id))!.revision);
  await db.update(users).set({ active: false }).where(eq(users.id, owner.id));
  await assert.rejects(runImports()); assert.equal(await db.$count(animals), 0);
  await db.update(users).set({ active: true }).where(eq(users.id, owner.id));
  view = (await getImport(scope, id))!;
  await saveCandidate(scope, owner.id, candidate.id, candidate.draft, true, false);
  await approveImport(scope, owner.id, id, true, (await getImport(scope, id))!.revision);
  await Promise.all([runImports(), runImports()]);
  assert.equal((await getImport(scope, id))!.state, "completed"); assert.equal(await db.$count(animals), 1);
  assert.ok((await readMedia(photo.targetKey)).length);
  execFileSync(process.execPath, ["scripts/media-cleanup.mjs", "--once"], { stdio: "pipe", env: process.env });
  assert.ok(!(await readdir(path.join(process.env.UPLOAD_DIR!, "t1"))).some(name => name.startsWith("import_")), "Staging files are removed after success");
  const repeat = await createImport(scope, owner.id, csv, "csv", "qa.csv", "old.example"); await runImports();
  view = (await getImport(scope, repeat))!; assert.equal(view.candidates[0].duplicate, true); assert.equal(view.candidates[0].selected, false);
  await cancelImport(scope, owner.id, repeat);
  const textId = await createImport(scope, owner.id, wxr.replace("https://old.example/sam.jpg", "http://127.0.0.1/forbidden"), "wordpress", "qa.xml", "wordpress.example"); await runImports();
  view = (await getImport(scope, textId))!; assert.equal(view.candidates[0].images[0].state, "failed");
  await cancelImport(scope, owner.id, textId);
  console.log("Guided import: owner-only, full image decoding, interruption recovery, rights revocation, deduplication and private WXR image failure: OK");
 } finally { await db.delete(tenants).where(eq(tenants.id, 1)); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
