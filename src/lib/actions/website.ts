"use server";
import { websiteSchema } from "../website/schema";
import { revalidatePath } from "next/cache";
import { requireOwner } from "../auth";
import { registerWebsiteImage, saveWebsite, type SaveResult } from "../website/service";
export async function saveWebsiteAction(_previous: SaveResult | null, data: FormData): Promise<SaveResult> {
  const user = await requireOwner();
  let input: unknown;
  try { input = JSON.parse(String(data.get("site") ?? "")); } catch { return { ok: false, error: "Ungültiges Website-Dokument." }; }
  const parsed = websiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültiges Website-Dokument." };
  const site = parsed.data;
  for (const key of Object.keys(site.design)) {
    const value = data.get(`design:${key}`);
    if (typeof value === "string") Object.assign(site.design, { [key]: value });
  }
  for (const page of site.pages) {
    for (const key of ["title", "description", "slug"] as const) {
      const value = data.get(`page:${page.id}:${key}`);
      if (typeof value === "string") page[key] = value;
    }
    page.navigation = data.has(`page:${page.id}:navigation`);
    for (const section of page.sections) {
      const tone = data.get(`section:${section.id}:tone`);
      if (tone === "plain" || tone === "soft" || tone === "brand") section.tone = tone;
    }
    for (const element of page.sections.flatMap(s => s.columns.flatMap(c => c.elements))) {
      for (const key of ["title", "text", "label", "href", "alt", "image"] as const) {
        const value = data.get(`element:${element.id}:${key}`);
        if (typeof value === "string") element[key] = value;
      }
      const align = data.get(`element:${element.id}:align`);
      if (align === "left" || align === "center") element.align = align;
      if (data.has(`element:${element.id}:count`)) element.count = Number(data.get(`element:${element.id}:count`));
      for (const [index, item] of element.items.entries()) for (const field of ["title", "text"] as const) {
        const value = data.get(`item:${element.id}:${index}:${field}`);
        if (typeof value === "string") item[field] = value;
      }
      for (const [index, image] of element.images.entries()) for (const field of ["url", "alt"] as const) {
        const value = data.get(`gallery:${element.id}:${index}:${field}`);
        if (typeof value === "string") image[field] = value;
      }
    }
  }
  const result = await saveWebsite(user.scope, user.id, Number(data.get("revision")), site, data.get("intent") === "publish");
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
export async function uploadWebsiteImage(data: FormData) {
  const user = await requireOwner();
  const file = data.get("image");
  if (!(file instanceof File)) return { error: "Bitte ein Bild auswählen." };
  return registerWebsiteImage(user.scope, user.id, file);
}
