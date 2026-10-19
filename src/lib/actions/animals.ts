"use server";

import { assertCurrentAccess } from "@/lib/access";

import { parseAnimal } from "@/lib/animal-fields";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { animalImages, animals, tenants } from "@/db/schema";
import { requireArea } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { checkImage, deleteFile, saveFile, ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import { type TenantScope } from "@/lib/tenant";
import { zodErrorState, type FormState } from "@/lib/form";

/** Alias, damit Formular und Action denselben Zustand teilen. */
export type AnimalFormState = FormState;


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


export async function createAnimal(
  _prev: AnimalFormState,
  formData: FormData,
): Promise<AnimalFormState> {
  // requireAdmin liefert den Verein gleich mit, ein zweiter Lookup entfaellt.
  const actor = await requireArea("animals");
  const { scope } = actor;

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
      await assertCurrentAccess(tx, actor, "animals");
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
  const actor = await requireArea("animals");
  const { scope } = actor;

  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const parsed = parseAnimal(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  const fotos = await savePhotos(scope, [
    ...(formData.getAll("photos") as File[]),
  ]);
  if (fotos.error) return { error: fotos.error };

  const revision = z.coerce.number().int().nonnegative().safeParse(formData.get("revision"));
  if (!formData.has("revision") || !revision.success) {
    await Promise.all(fotos.urls.map(url => deleteFile(scope.tenantId, url)));
    return { error: "Ungültiger Bearbeitungsstand. Bitte neu laden." };
  }
  let slug: string;
  try {
    slug = await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
      await assertCurrentAccess(tx, actor, "animals");
      const [current] = await tx.select().from(animals).where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id))).for("update");
      if (!current || current.revision !== revision.data) throw new Error("Das Tier wurde inzwischen geändert. Bitte den aktuellen Stand laden; Ihre Eingaben bleiben erhalten.");
      if (current.birthYear !== (parsed.data.birthYear ?? null)) {
        if (parsed.data.profile.age === current.profile.age) delete parsed.data.profile.age;
        if (parsed.data.profile.birthDate === current.profile.birthDate) delete parsed.data.profile.birthDate;
      }
      const slug = await uniqueSlug(scope, parsed.data.name, id, tx);
      await tx.update(animals).set({ ...parsed.data, birthYear: parsed.data.birthYear ?? null, breed: parsed.data.breed ?? null, size: parsed.data.size ?? null, revision: current.revision + 1, slug, updatedAt: new Date() })
        .where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)));
      if (fotos.urls.length) {
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${animalImages.sortOrder}), -1)::int` }).from(animalImages)
          .where(and(eq(animalImages.tenantId, scope.tenantId), eq(animalImages.animalId, id)));
        await tx.insert(animalImages).values(fotos.urls.map((url, i) => ({ tenantId: scope.tenantId, animalId: id, url, sortOrder: max + 1 + i })));
      }
      return slug;
    });
  } catch (error) {
    await Promise.all(fotos.urls.map(url => deleteFile(scope.tenantId, url)));
    return { error: error instanceof Error ? error.message : "Speichern fehlgeschlagen." };
  }

  revalidatePath("/tiere");
  revalidatePath("/");
  // slug steht seit dem UPDATE oben fest, ein erneutes SELECT waere umsonst.
  revalidatePath(`/tiere/${slug}`);
  redirect("/admin/tiere");
}

export async function deleteAnimalImage(formData: FormData): Promise<void> {
  const actor = await requireArea("animals");
  const { scope } = actor;
  const imageId = z.coerce
    .number()
    .int()
    .positive()
    .parse(formData.get("imageId"));
  // returning() liefert die URL der geloeschten Zeile, damit auch die Datei
  // verschwindet. Ohne das bleibt jedes entfernte Foto auf der Platte liegen.
  const removed = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "animals");
    return tx
    .delete(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, scope.tenantId),
        eq(animalImages.id, imageId),
      ),
    )
    .returning({ url: animalImages.url });
  });
  await Promise.all(
    removed.map((image) => deleteFile(scope.tenantId, image.url)),
  );
  revalidatePath("/admin/tiere");
}

export async function deleteAnimal(formData: FormData): Promise<void> {
  const actor = await requireArea("animals");
  const { scope } = actor;
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "animals");
    // The image trigger stores deletion intents in this same transaction.
    await tx.delete(animals).where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)));
  });
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
  const actor = await requireArea("animals");
  const { scope } = actor;
  const imageId = z.coerce
    .number()
    .int()
    .positive()
    .parse(formData.get("imageId"));
  const richtung = z.enum(["vor", "zurueck"]).parse(formData.get("richtung"));

  await db.transaction(async (tx) => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "animals");
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
  const actor = await requireArea("animals");
  const { scope } = actor;
  const id = z.coerce.number().int().positive().parse(formData.get("tierId"));
  const status = z
    .enum(["vermittelbar", "reserviert", "vermittelt"])
    .parse(formData.get("status"));

  const changed = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "animals");
    return tx
    .update(animals)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(animals.tenantId, scope.tenantId), eq(animals.id, id)))
    .returning({ slug: animals.slug });
  });

  revalidatePath("/admin/tiere");
  revalidatePath("/tiere");
  revalidatePath("/");
  if (changed[0]) revalidatePath(`/tiere/${changed[0].slug}`);
}
