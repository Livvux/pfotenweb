import { assertCurrentAccess } from "../access";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { animalImages, mediaDeletions, tenants, tenantSettings } from "@/db/schema";
import type { TenantScope } from "../tenant";
import { privateMediaStorage, saveImage, deleteFile } from "../storage";
import { initialWebsite } from "./presets";
import { stateMediaRefs, mediaRefs, websiteSchema, type WebsiteState } from "./schema";
export type SaveResult = { ok: true; revision: number; state: WebsiteState } | { ok: false; error: string; conflict?: boolean };
export async function loadWebsite(scope: TenantScope) {
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, scope.tenantId));
  if (!settings) throw new Error("Vereinsdaten fehlen.");
  return { state: settings.website ?? { draft: initialWebsite(settings), published: null, history: [] }, revision: settings.websiteRevision };
}
export async function saveWebsite(scope: TenantScope, actorId: number, revision: number, input: unknown, publish: boolean): Promise<SaveResult> {
  const parsed = websiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!Number.isSafeInteger(revision) || revision < 0) return { ok: false, error: "Ungültiger Speicherstand." };
  return db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, { id: actorId, scope }, "owner");
    const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, scope.tenantId)).for("update");
    if (!settings || settings.websiteRevision !== revision) return { ok: false, conflict: true, error: "Die Website wurde in einem anderen Tab geändert. Bitte den aktuellen Stand laden. Ihre Eingaben bleiben erhalten." };
    const old: WebsiteState = settings.website ?? { draft: initialWebsite(settings), published: null, history: [] };
    const images = await tx.select({ url: animalImages.url }).from(animalImages).where(eq(animalImages.tenantId, scope.tenantId));
    const known = new Set([...stateMediaRefs(old), ...settings.websiteMedia.map(m => m.url), ...images.map(m => m.url), settings.logoUrl, settings.heroImageUrl]);
    if (mediaRefs(parsed.data).some(url => !known.has(url))) return { ok: false, error: "Bitte ausschließlich Bilder aus dem Vereinsspeicher verwenden." };
    const state: WebsiteState = { draft: parsed.data, published: publish ? parsed.data : old.published, history: [{ date: new Date().toISOString(), site: old.draft }, ...old.history].slice(0, 10) };
    const retained = new Set(stateMediaRefs(state));
    const removed = stateMediaRefs(old).filter(url => !retained.has(url));
    if (removed.length) await tx.insert(mediaDeletions).values(removed.map(url => ({ url }))).onConflictDoNothing();
    await tx.update(tenantSettings).set({ website: state, websiteRevision: revision + 1, updatedAt: new Date() }).where(eq(tenantSettings.tenantId, scope.tenantId));
    return { ok: true, state, revision: revision + 1 };
  });
}
export async function registerWebsiteImage(scope: TenantScope, actorId: number, file: File) {
  if (!await privateMediaStorage())
    return { error: "Private Entwurfsbilder benötigen UPLOAD_DIR außerhalb von public. Bitte den Speicherpfad prüfen." };
  const result = await saveImage(scope.tenantId, file);
  if (!result.url) return { error: result.error ?? "Bitte ein Bild auswählen." };
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, { id: actorId, scope }, "owner");
      const [settings] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, scope.tenantId)).for("update");
      if (!settings) throw new Error("Vereinsdaten fehlen.");
      await tx.update(tenantSettings).set({ websiteMedia: [...settings.websiteMedia, { url: result.url!, createdAt: new Date().toISOString() }] }).where(eq(tenantSettings.tenantId, scope.tenantId));
    });
    return { url: result.url };
  } catch {
    await deleteFile(scope.tenantId, result.url);
    return { error: "Bild konnte nicht dem Entwurf zugeordnet werden." };
  }
}
export async function websiteImageIsPublic(url: string) {
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, 1));
  if (settings?.logoUrl === url || settings?.heroImageUrl === url || (settings?.website?.published && mediaRefs(settings.website.published).includes(url))) return true;
  const [image] = await db.select({ id: animalImages.id }).from(animalImages).where(and(eq(animalImages.tenantId, 1), eq(animalImages.url, url))).limit(1);
  return Boolean(image);
}
