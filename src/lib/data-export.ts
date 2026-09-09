import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { create } from "tar";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { animalImages, animals, inquiries, posts, tenantSettings } from "@/db/schema";
import { publicRoot } from "./storage";
import { exportSchema, type ExportData } from "./export-format";

function content<T extends { tenantId: number }>(row: T): Omit<T, "tenantId"> {
  const { tenantId: _tenantId, ...data } = row;
  void _tenantId;
  return data;
}

export async function createDataExport(tenantId: number): Promise<{ file: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pfotenweb-export-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    await mkdir(path.join(dir, "images"));
    const data = await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
      if (!settings) throw new Error("Vereinsdaten fehlen.");
      return {
        format: "pfotenweb-single" as const, version: 1 as const, exportedAt: new Date(),
        settings: content(settings),
        animals: (await tx.select().from(animals).where(eq(animals.tenantId, tenantId))).map(content),
        images: (await tx.select().from(animalImages).where(eq(animalImages.tenantId, tenantId))).map(content),
        posts: (await tx.select().from(posts).where(eq(posts.tenantId, tenantId))).map(content),
        inquiries: (await tx.select().from(inquiries).where(eq(inquiries.tenantId, tenantId))).map(content),
        files: [] as ExportData["files"],
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    const mapped = new Map<string, string>();
    async function include(url: string | null): Promise<string | null> {
      if (!url) return null;
      if (mapped.has(url)) return mapped.get(url)!;
      const own = new RegExp(`^/uploads/t${tenantId}/([a-zA-Z0-9_-]+\\.(?:jpg|png|webp))$`).exec(url);
      const seed = /^\/uploads\/([a-zA-Z0-9_-]+\.(?:jpg|png|webp))$/.exec(url);
      if (!own && !seed) throw new Error("Nicht unterstützte Bildreferenz im Export.");
      const source = own ? path.join(publicRoot(), `t${tenantId}`, own[1]) : path.join(process.cwd(), "public/uploads", seed![1]);
      const info = await lstat(source);
      if (!info.isFile() || info.size > 5 * 1024 * 1024) throw new Error("Bilddatei ungültig.");
      const digest = createHash("sha256").update(await readFile(source)).digest("hex");
      const name = `${digest}${path.extname(source)}`;
      if (!data.files.some((f) => f.name === name)) {
        await copyFile(source, path.join(dir, "images", name));
        data.files.push({ name, bytes: info.size, sha256: digest });
      }
      const target = `images/${name}`;
      mapped.set(url, target);
      return target;
    }
    data.settings.logoUrl = await include(data.settings.logoUrl);
    data.settings.heroImageUrl = await include(data.settings.heroImageUrl);
    for (const image of data.images) image.url = (await include(image.url))!;
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify(exportSchema.parse(data)), { mode: 0o600 });
    const file = path.join(dir, "pfotenweb.tar.gz");
    await create({ cwd: dir, file, gzip: true, portable: true }, ["manifest.json", "images"]);
    return { file, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
