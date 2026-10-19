"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { requireAdmin } from "../auth";
import { assertCurrentAccess } from "../access";
import { privateMediaStorage, saveImage, deleteFile } from "../storage";
import { zodErrorState, type FormState } from "../form";
export async function saveOwnProfile(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireAdmin();
  const parsed = z.object({ displayName: z.string().trim().max(80), profileRole: z.string().trim().max(100), bio: z.string().trim().max(500), revision: z.iso.datetime() }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  const file = data.get("image");
  let uploaded: string | undefined;
  if (file instanceof File && file.size) {
    if (!await privateMediaStorage()) return { error: "Profilbilder benötigen UPLOAD_DIR außerhalb von public." };
    const image = await saveImage(1, file);
    if (!image.url) return { error: image.error ?? "Bild konnte nicht gespeichert werden." };
    uploaded = image.url;
  }
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
      await assertCurrentAccess(tx, actor, "self");
      const [current] = await tx.select().from(users).where(and(eq(users.id, actor.id), eq(users.tenantId, 1))).for("update");
      if (!current || current.updatedAt.getTime() !== new Date(parsed.data.revision).getTime()) throw new Error("Das Profil wurde inzwischen geändert. Bitte neu laden.");
      await tx.update(users).set({ displayName: parsed.data.displayName || null, profileRole: parsed.data.profileRole || null, bio: parsed.data.bio || null, ...(uploaded ? { profileImage: uploaded } : data.get("removeImage") === "on" ? { profileImage: null } : {}), updatedAt: new Date() }).where(eq(users.id, actor.id));
    });
  } catch {
    if (uploaded) await deleteFile(1, uploaded);
    return { error: "Das Profil wurde inzwischen geändert oder der Zugang entzogen. Bitte neu laden; die Eingaben bleiben bis dahin im Formular." };
  }
  revalidatePath("/admin", "layout");
  return { success: true };
}
