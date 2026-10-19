import { constants } from "node:fs";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, realpath, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { list, extract } from "tar";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, animalImages, posts, inquiries, inquiryReplies, tenantSettings, tenants, donationSettings, users } from "@/db/schema";
import { compatibleImport } from "./import-compatibility";
import { mapStateMedia, stateMediaRefs } from "./website/schema";
import { normalizeUploadImage } from "./upload-image";
import { publicRoot, privateMediaStorage } from "./storage";

/** Offline import into a fresh installation; production app must be stopped. */
export async function importData(file: string, tenantId: number): Promise<{ additional: string[]; sourceArchive: string | null }> {
  const stage = await mkdtemp(path.join(tmpdir(), "pfotenweb-import-"));
  const copied: string[] = [];
  let sourceArchive: string | null = null;
  try {
    const seen = new Set<string>();
    let total = 0;
    let invalid = false;
    await list({ file, strict: true, onReadEntry(entry) {
      const name = entry.path;
      const valid = (name === "images/" && entry.type === "Directory") || ((name === "manifest.json" || /^images\/[a-f0-9]{64}\.(jpg|png|webp|mp4|pdf)$/.test(name)) && entry.type === "File");
      total += entry.size;
      if (!valid || seen.has(name) || total > 50_000_000_000 || seen.size > 500_001 || (name === "manifest.json" ? entry.size > 100_000_000 : entry.size > 50_000_000)) invalid = true;
      seen.add(name);
    } });
    if (invalid || !seen.has("manifest.json")) throw new Error("Archiv enthält ungültige Pfade, Dateien oder Größen.");
    await extract({ file, cwd: stage, strict: true, noChmod: true, noMtime: true, filter: (name) => seen.has(name) });
    const compatible = compatibleImport(JSON.parse(await readFile(path.join(stage, "manifest.json"), "utf8")));
    const { data } = compatible;
    const existingUsers = await db.select({ username: users.username }).from(users).where(eq(users.tenantId, tenantId));
    const usernames = new Set(existingUsers.map(user => user.username));
    if (data.profiles.some(profile => !usernames.has(profile.username))) compatible.additional.push("profiles (nicht vorhandene Konten)");
    data.profiles = data.profiles.filter(profile => usernames.has(profile.username));
    const usedMedia = new Set([data.settings.logoUrl, data.settings.heroImageUrl, ...data.images.map(image => image.url), ...stateMediaRefs(data.settings.website), ...data.settings.websiteMedia.map(image => image.url), ...data.profiles.map(profile => profile.avatar)]);
    data.files = data.files.filter(file => usedMedia.has(`images/${file.name}`));
    if (data.profiles.some(profile => profile.avatar) && !await privateMediaStorage()) throw new Error("Private Profilbilder benötigen UPLOAD_DIR außerhalb von public.");
    if ((data.settings.website || data.settings.websiteMedia.length) && !await privateMediaStorage())
      throw new Error("Private Website-Entwürfe benötigen UPLOAD_DIR außerhalb von public.");
    const files = new Map<string, string>();
    const normalizedDir = path.join(stage, "normalized");
    await mkdir(normalizedDir, { mode: 0o700 });
    const importedFiles = new Set(data.files.map(file => file.name));
    for (const image of compatible.files) {
      const source = path.join(stage, "images", image.name);
      const bytes = await readFile(source);
      if (bytes.length !== image.bytes || createHash("sha256").update(bytes).digest("hex") !== image.sha256) throw new Error("Bild-Prüfsumme stimmt nicht.");
      if (importedFiles.has(image.name)) {
        const sourceName = `images/${image.name}`;
        await writeFile(path.join(normalizedDir, image.name), await normalizeUploadImage(bytes, path.extname(image.name)), { mode: 0o600 });
        files.set(sourceName, `${randomBytes(12).toString("hex")}${path.extname(image.name)}`);
      }
    }
    if (seen.size !== compatible.files.length + 2) throw new Error("Archiv enthält nicht zugeordnete Dateien.");
    if (compatible.additional.length) {
      const archiveRoot = process.env.IMPORT_ARCHIVE_DIR;
      if (!archiveRoot || !path.isAbsolute(archiveRoot)) throw new Error("Zusatzdaten benötigen IMPORT_ARCHIVE_DIR als absolutes privates Archivverzeichnis.");
      await mkdir(archiveRoot, { recursive: true, mode: 0o700 });
      const absolute = await realpath(archiveRoot);
      for (const directory of [publicRoot(), path.resolve("public")]) {
        const forbidden = await realpath(directory).catch(() => path.resolve(directory));
        const relative = path.relative(forbidden, absolute);
        if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("Importarchiv muss außerhalb öffentlich ausgelieferter Verzeichnisse liegen.");
      }
      sourceArchive = path.join(absolute, `source-${randomBytes(16).toString("hex")}.tar.gz`);
      await copyFile(file, sourceArchive, constants.COPYFILE_EXCL);
      await chmod(sourceArchive, 0o600);
    }
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
        await copyFile(path.join(normalizedDir, path.basename(source)), target, constants.COPYFILE_EXCL);
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
      const inquiryIds = new Map<number, number>();
      for (const original of data.inquiries) {
        if (inquiryIds.has(original.id)) throw new Error("Doppelte Anfrage-ID.");
        const { id: _id, animalId, ...values } = original;
        void _id;
        const mapped = animalId === null ? null : ids.get(animalId);
        if (mapped === undefined) throw new Error("Anfrage verweist auf fehlendes Tier.");
        const [inserted] = await tx.insert(inquiries).values({ ...values, tenantId, animalId: mapped }).returning({ id: inquiries.id });
        inquiryIds.set(_id, inserted.id);
      }
      for (const reply of data.inquiryReplies) {
        const { id: _id, inquiryId, ...values } = reply; void _id;
        const mapped = inquiryIds.get(inquiryId);
        if (!mapped) throw new Error("Antwort verweist auf fehlende Anfrage.");
        await tx.insert(inquiryReplies).values({ ...values, tenantId, inquiryId: mapped, requestId: randomUUID(), deliveryStatus: "imported" });
      }
      for (const profile of data.profiles) {
        const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.username, profile.username)).for("update");
        if (!account) throw new Error("Ein zugeordnetes Profilkonto wurde inzwischen entfernt.");
        await tx.update(users).set({ displayName: profile.displayName, profileRole: profile.teamTitle, bio: profile.bio, profileImage: imageUrl(profile.avatar), updatedAt: new Date() }).where(eq(users.id, account.id));
      }
      if (data.donations) await tx.insert(donationSettings).values({ ...data.donations, tenantId }).onConflictDoUpdate({ target: donationSettings.tenantId, set: { ...data.donations, updatedAt: new Date() } });
      await tx.update(tenantSettings).set({ ...data.settings, logoUrl: imageUrl(data.settings.logoUrl), heroImageUrl: imageUrl(data.settings.heroImageUrl), website: await mapStateMedia(data.settings.website, async url => imageUrl(url)!), websiteRevision: 0, websiteMedia: data.settings.websiteMedia.map(image => ({ ...image, url: imageUrl(image.url)! })) }).where(eq(tenantSettings.tenantId, tenantId));
    });
    return { additional: compatible.additional, sourceArchive };
  } catch (error) {
    await Promise.all(copied.map((name) => rm(name, { force: true })));
    if (sourceArchive) await rm(sourceArchive, { force: true });
    throw error;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
