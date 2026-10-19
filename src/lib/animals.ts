import { cache } from "react";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { animalImages, animals } from "@/db/schema";
import type { TenantScope } from "@/lib/tenant";

export type Animal = typeof animals.$inferSelect;
export type AnimalImage = typeof animalImages.$inferSelect;
export type AnimalWithImages = Animal & { images: AnimalImage[] };

export { SPECIES_LABELS, STATUS_LABELS, ageText } from "./animal-display";

export type AnimalFilters = {
  species?: Animal["species"];
  status?: Animal["status"];
  sex?: string;
  q?: string;
  limit?: number;
  offset?: number;
  coverOnly?: boolean;
};
function animalConditions(t: TenantScope, filters?: AnimalFilters) {
  const conditions = [eq(animals.tenantId, t.tenantId)];
  if (filters?.species) conditions.push(eq(animals.species, filters.species));
  if (filters?.status) conditions.push(eq(animals.status, filters.status));
  if (filters?.sex) conditions.push(eq(animals.sex, filters.sex));
  for (const word of (filters?.q ?? "").trim().slice(0, 120).split(/\s+/).filter(Boolean)) {
    const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(sql`concat_ws(' ', ${animals.name}, ${animals.breed}, ${animals.description}, ${animals.species}) ilike ${pattern}`);
  }
  return and(...conditions);
}
export async function countAnimals(t: TenantScope, filters?: AnimalFilters): Promise<number> {
  const [row] = await db.select({ n: count() }).from(animals).where(animalConditions(t, filters));
  return row.n;
}
export async function getAnimals(
  t: TenantScope,
  filters?: AnimalFilters,
): Promise<AnimalWithImages[]> {

  const rows = await db
    .select()
    .from(animals)
    .where(animalConditions(t, filters))
    .orderBy(desc(animals.featured), desc(animals.createdAt), desc(animals.id))
    .limit(filters?.limit ?? 100000).offset(filters?.offset ?? 0);

  if (rows.length === 0) return [];

  // Frueher wurden hier ALLE Bilder ohne Filter geladen. Jetzt nur die Bilder
  // der tatsaechlich ausgewaehlten Tiere: bei einer Artfilterung holt das nicht
  // laenger den gesamten Bestand des Vereins mit.
  const images = await (filters?.coverOnly ? db.selectDistinctOn([animalImages.animalId]) : db.select())
    .from(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, t.tenantId),
        inArray(
          animalImages.animalId,
          rows.map((a) => a.id),
        ),
      ),
    )
    .orderBy(asc(animalImages.animalId), asc(animalImages.sortOrder), asc(animalImages.id));

  const byAnimal = new Map<number, AnimalImage[]>();
  for (const img of images) {
    const list = byAnimal.get(img.animalId) ?? [];
    list.push(img);
    byAnimal.set(img.animalId, list);
  }

  return rows.map((a) => ({ ...a, images: byAnimal.get(a.id) ?? [] }));
}

export async function getAnimalSlugs(
  t: TenantScope,
): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: animals.slug, updatedAt: animals.updatedAt })
    .from(animals)
    .where(eq(animals.tenantId, t.tenantId));
}

/*
 * cache() dedupliziert innerhalb eines Requests. Ohne das laedt jede
 * Detailseite ihr Tier zweimal, einmal fuer generateMetadata und einmal fuer
 * die Seite selbst.
 *
 * React vergleicht die Argumente per Identitaet. Der Schluessel muss deshalb
 * (tenantId, slug) sein und nicht das Scope-Objekt: scopeOf() baut bei jedem
 * Aufruf ein neues, der Cache haette nie getroffen. Die oeffentliche Funktion
 * behaelt den TenantScope, damit der Vereinsfilter Pflicht bleibt.
 */
const ladeAnimalBySlug = cache(async function ladeAnimalBySlug(
  tenantId: number,
  slug: string,
): Promise<AnimalWithImages | null> {
  const [animal] = await db
    .select()
    .from(animals)
    .where(and(eq(animals.tenantId, tenantId), eq(animals.slug, slug)));
  if (!animal) return null;
  const images = await db
    .select()
    .from(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, tenantId),
        eq(animalImages.animalId, animal.id),
      ),
    )
    .orderBy(asc(animalImages.sortOrder));
  return { ...animal, images };
});

export function getAnimalBySlug(
  t: TenantScope,
  slug: string,
): Promise<AnimalWithImages | null> {
  return ladeAnimalBySlug(t.tenantId, slug);
}

/**
 * Fuer den Adminbereich: Zugriff ueber die numerische ID, aber niemals ohne
 * Vereinsfilter. Ein fremdes Tier ist damit schlicht nicht auffindbar.
 */
export async function getAnimalByIdForAdmin(
  t: TenantScope,
  id: number,
): Promise<AnimalWithImages | null> {
  const [animal] = await db
    .select()
    .from(animals)
    .where(and(eq(animals.tenantId, t.tenantId), eq(animals.id, id)));
  if (!animal) return null;
  const images = await db
    .select()
    .from(animalImages)
    .where(
      and(
        eq(animalImages.tenantId, t.tenantId),
        eq(animalImages.animalId, animal.id),
      ),
    )
    .orderBy(asc(animalImages.sortOrder));
  return { ...animal, images };
}

/**
 * Nur die Anzahl, ohne die Bilder mitzuladen.
 *
 * Fuer die Einrichtungs-Checkliste und die Freischaltung reicht die Zahl. Ein
 * getAnimals().length wuerde dafuer jedes Tier samt Fotos aus der Datenbank
 * holen.
 */
export async function getAnimalCount(t: TenantScope): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(animals)
    .where(eq(animals.tenantId, t.tenantId));
  return row.value;
}
