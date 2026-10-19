import { and, eq } from "drizzle-orm";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import { db } from "@/db";
import { animals } from "@/db/schema";
import { getAnimalByIdForAdmin, STATUS_LABELS } from "./animals";
import { publicAnimalFacts } from "./public-animal-facts";
import { publicRoot } from "./storage";
import { addressLines, getTenantSiteUrl, type TenantScope, type TenantSettings } from "./tenant";
import type { AnimalPdfData } from "./animal-pdf";
export async function animalByPublicId(scope: TenantScope, publicId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId)) return null;
  const [row] = await db.select({ slug: animals.slug }).from(animals).where(and(eq(animals.tenantId, scope.tenantId), eq(animals.publicId, publicId)));
  return row ?? null;
}
export async function pdfImage(scope: TenantScope, url: string | null | undefined) {
  const match = new RegExp(`^/uploads/t${scope.tenantId}/([a-zA-Z0-9_-]+\\.(jpg|png|webp))$`).exec(url ?? "");
  if (!match) return undefined;
  try {
    const file = path.join(publicRoot(), `t${scope.tenantId}`, match[1]);
    const info = await lstat(file);
    if (!info.isFile() || info.size > 5 * 1024 * 1024) return undefined;
    return await sharp(await readFile(file), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch { return undefined; }
}
export async function animalPdfData(scope: TenantScope, settings: TenantSettings, id: number): Promise<AnimalPdfData | null> {
  const animal = await getAnimalByIdForAdmin(scope, id);
  if (!animal) return null;
  const url = new URL(`/tier/${animal.publicId}`, await getTenantSiteUrl()).href;
  return { name: animal.name, status: STATUS_LABELS[animal.status], orgName: settings.orgName, color: settings.colorPrimary, facts: publicAnimalFacts(animal, animal.profile), description: animal.description,
    contact: [settings.publicEmail, settings.phone, ...addressLines(settings)].filter((value): value is string => Boolean(value)), url,
    qr: await QRCode.toDataURL(url, { margin: 4, width: 320, errorCorrectionLevel: "M" }), photo: await pdfImage(scope, animal.images[0]?.url), logo: await pdfImage(scope, settings.logoUrl) };
}
