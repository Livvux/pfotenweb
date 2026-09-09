import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { list, extract } from "tar";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, animalImages, posts, inquiries, tenantSettings, tenants } from "@/db/schema";
import { exportSchema } from "./export-format";
import { publicRoot } from "./storage";

/** Offline import into a fresh installation; production app must be stopped. */
export async function importData(file: string, tenantId: number): Promise<void> {
  const stage = await mkdtemp(path.join(tmpdir(), "pfotenweb-import-"));
  const copied: string[] = [];
  try {
    const seen = new Set<string>();
    let total = 0;
    let invalid = false;
    await list({ file, strict: true, onReadEntry(entry) {
      const name = entry.path;
      const valid = (name === "images/" && entry.type === "Directory") || ((name === "manifest.json" || /^images\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(name)) && entry.type === "File");
      total += entry.size;
      if (!valid || seen.has(name) || total > 50_000_000_000 || seen.size > 500_001 || (name === "manifest.json" ? entry.size > 100_000_000 : entry.size > 5 * 1024 * 1024)) invalid = true;
      seen.add(name);
    } });
    if (invalid || !seen.has("manifest.json")) throw new Error("Archiv enthält ungültige Pfade, Dateien oder Größen.");
    await extract({ file, cwd: stage, strict: true, noChmod: true, noMtime: true, filter: (name) => seen.has(name) });
    const data = exportSchema.parse(JSON.parse(await readFile(path.join(stage, "manifest.json"), "utf8")));
    const files = new Map<string, string>();
    for (const image of data.files) {
      const source = path.join(stage, "images", image.name);
      const bytes = await readFile(source);
      if (bytes.length !== image.bytes || createHash("sha256").update(bytes).digest("hex") !== image.sha256) throw new Error("Bild-Prüfsumme stimmt nicht.");
      files.set(`images/${image.name}`, `${randomBytes(12).toString("hex")}${path.extname(image.name)}`);
    }
    if (seen.size !== data.files.length + 2) throw new Error("Archiv enthält nicht zugeordnete Dateien.");
    const imageUrl = (url: string | null): string | null => {
      if (!url) return null;
      const name = files.get(url);
      if (!name) throw new Error("Bildreferenz fehlt im Archiv.");
      return `/uploads/t${tenantId}/${name}`;
    };
    const targetDir = path.join(publicRoot(), `t${tenantId}`);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(73, ${tenantId})`);
      const [association] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for("update");
      if (!association) throw new Error("Bitte zuerst die Ersteinrichtung ausführen.");
      for (const table of [animals, posts, inquiries]) {
        const [row] = await tx.select({ n: count() }).from(table).where(eq(table.tenantId, tenantId));
        if (row.n) throw new Error("Import ist nur in eine leere Installation möglich.");
      }
      const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
      if (settings?.logoUrl || settings?.heroImageUrl) throw new Error("Installation enthält bereits Bilder.");
      await mkdir(targetDir, { recursive: true });
      for (const [source, name] of files) {
        const target = path.join(targetDir, name);
        copied.push(target);
        await copyFile(path.join(stage, source), target);
      }
      const ids = new Map<number, number>();
      for (const original of data.animals) {
        const { id, ...values } = original;
        if (ids.has(id)) throw new Error("Doppelte Tier-ID.");
        const [animal] = await tx.insert(animals).values({ ...values, tenantId }).returning({ id: animals.id });
        ids.set(id, animal.id);
      }
      for (const original of data.images) {
        const { id: _id, animalId, url, ...values } = original;
        void _id;
        const mapped = ids.get(animalId);
        if (!mapped) throw new Error("Tierreferenz fehlt.");
        await tx.insert(animalImages).values({ ...values, tenantId, animalId: mapped, url: imageUrl(url)! });
      }
      for (const original of data.posts) {
        const { id: _id, ...values } = original;
        void _id;
        await tx.insert(posts).values({ ...values, tenantId });
      }
      for (const original of data.inquiries) {
        const { id: _id, animalId, ...values } = original;
        void _id;
        const mapped = animalId === null ? null : ids.get(animalId);
        if (mapped === undefined) throw new Error("Anfrage verweist auf fehlendes Tier.");
        await tx.insert(inquiries).values({ ...values, tenantId, animalId: mapped });
      }
      await tx.update(tenantSettings).set({ ...data.settings, logoUrl: imageUrl(data.settings.logoUrl), heroImageUrl: imageUrl(data.settings.heroImageUrl) }).where(eq(tenantSettings.tenantId, tenantId));
    });
  } catch (error) {
    await Promise.all(copied.map((name) => rm(name, { force: true })));
    throw error;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
