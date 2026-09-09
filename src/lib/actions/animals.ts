"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { animalImages, animals, tenants } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { checkImage, deleteFile, saveFile, ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import { type TenantScope } from "@/lib/tenant";
import { zodErrorState, type FormState } from "@/lib/form";

/** Alias, damit Formular und Action denselben Zustand teilen. */
export type AnimalFormState = FormState;

const animalSchema = z.object({
  name: z.string().trim().min(2, "Name ist zu kurz.").max(80),
  species: z.enum(["hund", "katze", "kleintier", "vogel", "sonstiges"]),
  breed: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
  sex: z.enum(["m", "w", "u"]),
  birthYear: z.coerce
    .number()
    .int()
    .min(1990, "Geburtsjahr ungültig.")
    .max(new Date().getFullYear(), "Geburtsjahr liegt in der Zukunft.")
    .optional(),
  size: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(["vermittelbar", "reserviert", "vermittelt"]),
  featured: z.boolean().optional().default(false),
  description: z
    .string()
    .trim()
    .min(20, "Beschreibung sollte mindestens 20 Zeichen enthalten.")
    .max(5000),
});

/** Pro Absenden. Mehr passt nicht in das Body-Limit aus next.config.ts. */
const MAX_PHOTOS = 8;

/**
 * Speichert alle ausgewaehlten Fotos.
 *
 * Zwei Durchlaeufe, nicht einer: erst wird jede Datei geprueft, dann wird
 * geschrieben. Andernfalls haette ein Fehler in Datei fuenf schon vier
 * verwaiste Dateien auf der Platte hinterlassen, ohne dass ein Datensatz
 * darauf zeigt.
 *
 * Bricht das Schreiben mittendrin ab, werden die bereits geschriebenen Dateien
 * wieder entfernt. Ein Upload ist damit ganz oder gar nicht passiert.
 */
async function savePhotos(
  t: TenantScope,
  files: File[],
): Promise<{ urls: string[]; error?: string }> {
  const gewaehlt = files.filter((f) => f instanceof File && f.size > 0);
  if (gewaehlt.length === 0) return { urls: [] };
  if (gewaehlt.length > MAX_PHOTOS) {
    return {
      urls: [],
      error: `Höchstens ${MAX_PHOTOS} Fotos auf einmal. Bitte in mehreren Schritten hochladen.`,
    };
  }

  for (const file of gewaehlt) {
    const fehler = checkImage(file);
    if (fehler) return { urls: [], error: fehler };
  }

  const urls: string[] = [];
  try {
    for (const file of gewaehlt) {
      urls.push(
        await saveFile(
          t.tenantId,
          Buffer.from(await file.arrayBuffer()),
          ALLOWED_IMAGE_TYPES.get(file.type) ?? ".jpg",
        ),
      );
    }
  } catch (error) {
    await Promise.all(urls.map((url) => deleteFile(t.tenantId, url)));
    return {
      urls: [],
      error: error instanceof Error ? error.message : "Die Fotos konnten nicht gespeichert werden.",
    };
  }
  return { urls };
}

async function uniqueSlug(
  t: TenantScope,
  name: string,
  excludeId?: number,
  connection: Pick<typeof db, "select"> = db,
): Promise<string> {
  const base = slugify(name) || "tier";
  let candidate = base;
  for (let i = 2; ; i++) {
    const [existing] = await connection
      .select({ id: animals.id })
      .from(animals)
      .where(
        and(eq(animals.tenantId, t.tenantId), eq(animals.slug, candidate)),
      );
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
  }
}

function parseAnimal(formData: FormData) {
  return animalSchema.safeParse({
    name: formData.get("name"),
    species: formData.get("species"),
    breed: formData.get("breed"),
    sex: formData.get("sex"),
    birthYear: formData.get("birthYear") || undefined,
    size: formData.get("size"),
    status: formData.get("status"),
    featured: formData.get("featured") === "on",
    description: formData.get("description"),
  });
}

export async function createAnimal(
  _prev: AnimalFormState,
  formData: FormData,
): Promise<AnimalFormState> {
  // requireAdmin liefert den Verein gleich mit, ein zweiter Lookup entfaellt.
  const { scope } = await requireAdmin();

  const parsed = parseAnimal(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  const fotos = await savePhotos(scope, formData.getAll("photos") as File[]);
  if (fotos.error) return { error: fotos.error };
  let animalId: number;
  try {
    animalId = await db.transaction(async (tx) => {
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
      if (!tenant) throw new Error("Verein nicht gefunden.");
      const slug = await uniqueSlug(scope, parsed.data.name, undefined, tx);
      const [animal] = await tx.insert(animals).values({ ...parsed.data, slug, tenantId: scope.tenantId }).returning({ id: animals.id });
      if (fotos.urls.length) await tx.insert(animalImages).values(fotos.urls.map((url, sortOrder) => ({ tenantId: scope.tenantId, animalId: animal.id, url, sortOrder })));
      return animal.id;
    });
  } catch (error) {
    await Promise.all(fotos.urls.map((url) => deleteFile(scope.tenantId, url)));
    return { error: error instanceof Error ? error.message : "Tier konnte nicht gespeichert werden." };
  }

  revalidatePath("/tiere");
  revalidatePath("/");
  redirect(`/admin/tiere/${animalId}`);
}

export async function updateAnimal(
  _prev: AnimalFormState,
  formData: FormData,
): Promise<AnimalFormState> {
  const { scope } = await requireAdmin();

  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const parsed = parseAnimal(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  const fotos = await savePhotos(scope, [
    ...(formData.getAll("photos") as File[]),
  ]);
  if (fotos.error) return { error: fotos.error };

  const slug = await uniqueSlug(scope, parsed.data.name, id);
  // Der Verein steht in derselben Query wie die ID. Kein "erst lesen, dann
  // pruefen": das waere race-anfaellig.
  const changed = await db
    .update(animals)
    .set({ ...parsed.data, slug, updatedAt: new Date() })
    .where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)))
    .returning({ id: animals.id });
  if (changed.length === 0) return { error: "Tier nicht gefunden." };

  if (fotos.urls.length > 0) {
    const [{ max }] = await db
      .select({
        max: sql<number>`coalesce(max(${animalImages.sortOrder}), -1)::int`,
      })
      .from(animalImages)
      .where(
        and(
          eq(animalImages.tenantId, scope.tenantId),
          eq(animalImages.animalId, id),
        ),
      );
    await db.insert(animalImages).values(
      fotos.urls.map((url, i) => ({
        tenantId: scope.tenantId,
        animalId: id,
        url,
        sortOrder: max + 1 + i,
      })),
    );
  }

  revalidatePath("/tiere");
  revalidatePath("/");
  // slug steht seit dem UPDATE oben fest, ein erneutes SELECT waere umsonst.
  revalidatePath(`/tiere/${slug}`);
  redirect("/admin/tiere");
}

export async function deleteAnimalImage(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const imageId = z.coerce
    .number()
    .int()
    .positive()
    .parse(formData.get("imageId"));
  // returning() liefert die URL der geloeschten Zeile, damit auch die Datei
  // verschwindet. Ohne das bleibt jedes entfernte Foto auf der Platte liegen.
  const removed = await db
    .delete(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, scope.tenantId),
        eq(animalImages.id, imageId),
      ),
    )
    .returning({ url: animalImages.url });
  await Promise.all(
    removed.map((image) => deleteFile(scope.tenantId, image.url)),
  );
  revalidatePath("/admin/tiere");
}

export async function deleteAnimal(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  // Die Bilderzeilen raeumt der Fremdschluessel per ON DELETE CASCADE weg,
  // die Dateien auf der Platte nicht. Also vorher die URLs holen.
  const images = await db
    .select({ url: animalImages.url })
    .from(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, scope.tenantId),
        eq(animalImages.animalId, id),
      ),
    );
  await db
    .delete(animals)
    .where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)));
  await Promise.all(images.map((i) => deleteFile(scope.tenantId, i.url)));
  revalidatePath("/tiere");
  revalidatePath("/");
  redirect("/admin/tiere");
}

/**
 * Verschiebt ein Foto eine Position nach vorne oder hinten.
 *
 * Wichtig ist die Normalisierung: sortOrder war bisher nirgends eindeutig
 * (Seed und createAnimal setzten alles auf 0). Ein reiner Tausch zweier Werte
 * haette bei Gleichstand sichtbar nichts bewirkt. Deshalb wird die Reihenfolge
 * in derselben Transaktion erst auf 0..n-1 gerade gezogen und dann getauscht.
 *
 * Die Sortierung nach (sortOrder, id) macht das Ergebnis auch bei Gleichstand
 * eindeutig: aeltere Bilder stehen vorn, so wie sie heute schon angezeigt werden.
 */
export async function moveAnimalImage(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const imageId = z.coerce
    .number()
    .int()
    .positive()
    .parse(formData.get("imageId"));
  const richtung = z.enum(["vor", "zurueck"]).parse(formData.get("richtung"));

  await db.transaction(async (tx) => {
    const [bild] = await tx
      .select({ animalId: animalImages.animalId })
      .from(animalImages)
      .where(
        and(
          eq(animalImages.tenantId, scope.tenantId),
          eq(animalImages.id, imageId),
        ),
      );
    if (!bild) return;

    const alle = await tx
      .select({ id: animalImages.id })
      .from(animalImages)
      .where(
        and(
          eq(animalImages.tenantId, scope.tenantId),
          eq(animalImages.animalId, bild.animalId),
        ),
      )
      .orderBy(animalImages.sortOrder, animalImages.id);

    const ids = alle.map((b) => b.id);
    const von = ids.indexOf(imageId);
    const nach = richtung === "vor" ? von - 1 : von + 1;
    if (von >= 0 && nach >= 0 && nach < ids.length) {
      [ids[von], ids[nach]] = [ids[nach], ids[von]];
    }

    // Immer alle Zeilen schreiben, auch wenn nicht getauscht wurde: das ist der
    // Moment, in dem eine alte Sortierung aus Seed-Zeiten gerade gezogen wird.
    for (const [i, id] of ids.entries()) {
      await tx
        .update(animalImages)
        .set({ sortOrder: i })
        .where(
          and(
            eq(animalImages.tenantId, scope.tenantId),
            eq(animalImages.id, id),
          ),
        );
    }
  });

  revalidatePath("/tiere");
  revalidatePath("/");
}

/**
 * Setzt den Vermittlungsstatus aus der Tierliste heraus.
 *
 * Das versteckte Feld heisst absichtlich tierId und nicht id: in derselben
 * Zeile steht auch das Loeschformular mit input[name="id"], und der
 * E2E-Selektor in e2e/utils.ts wuerde sonst zwei Formulare treffen.
 */
export async function setAnimalStatus(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("tierId"));
  const status = z
    .enum(["vermittelbar", "reserviert", "vermittelt"])
    .parse(formData.get("status"));

  const changed = await db
    .update(animals)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)))
    .returning({ slug: animals.slug });

  revalidatePath("/admin/tiere");
  revalidatePath("/tiere");
  revalidatePath("/");
  if (changed[0]) revalidatePath(`/tiere/${changed[0].slug}`);
}
