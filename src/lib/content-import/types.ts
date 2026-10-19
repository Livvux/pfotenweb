import { z } from "zod";
import { animalSchema, postSchema } from "../content-schemas";

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_CANDIDATES = 1000;
export const MAX_IMAGES = 8;
export const textFields = {
  heroHeadline: { label: "Startseite: Überschrift", max: 200 },
  heroSubline: { label: "Startseite: Einführung", max: 2000 },
  tagline: { label: "Vereinsmotto", max: 200 },
  aboutIntro: { label: "Über uns: Einführung", max: 4000 },
  aboutWork: { label: "Über uns: Unsere Arbeit", max: 4000 },
  aboutSupport: { label: "Über uns: Helfen", max: 4000 },
} as const;
export const textFieldSchema = z.enum(["heroHeadline", "heroSubline", "tagline", "aboutIntro", "aboutWork", "aboutSupport"]);
export type TextField = z.infer<typeof textFieldSchema>;
export const draftSchema = z.object({
  kind: z.enum(["animal", "post", "text", "skip"]),
  title: z.string().max(1000), body: z.string().max(100_000),
  species: z.string().max(100), sex: z.string().max(20), status: z.string().max(100),
  breed: z.string().max(200), birthYear: z.string().max(10), size: z.string().max(50),
  published: z.boolean(), textField: textFieldSchema,
});
export type Draft = z.infer<typeof draftSchema>;
export type SourceRow = { key: string; fields: Record<string, string>; images: string[]; warnings: string[] };
export const columnNames = ["id", "title", "body", "species", "sex", "status", "breed", "birthYear", "size", "images"] as const;
export type Column = typeof columnNames[number];
export const mappingSchema = z.object({ kind: z.enum(["animal", "post", "text"]), columns: z.record(z.enum(columnNames), z.string().max(200)) });
export type Mapping = z.infer<typeof mappingSchema>;
export const defaultDraft: Draft = { kind: "animal", title: "", body: "", species: "", sex: "u", status: "vermittelbar", breed: "", birthYear: "", size: "", published: false, textField: "aboutIntro" };
export function validateDraft(d: Draft): string[] {
  if (d.kind === "skip") return [];
  if (d.kind === "text") return d.body.trim().length === 0 || d.body.length > textFields[d.textField].max ? [`${textFields[d.textField].label}: 1–${textFields[d.textField].max} Zeichen erforderlich.`] : [];
  const parsed = d.kind === "animal" ? animalSchema.safeParse(animalValues(d)) : postSchema.safeParse(postValues(d));
  return parsed.success ? [] : parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
}
export function animalValues(d: Draft) {
  return { profile: {}, name: d.title, description: d.body, species: d.species, sex: d.sex, status: d.status, breed: d.breed, size: d.size, birthYear: d.birthYear ? Number(d.birthYear) : undefined, featured: false };
}
export function postValues(d: Draft) { return { title: d.title, body: d.body, published: d.published }; }
export const stateLabels: Record<string, string> = { preparing: "Vorbereitung", review: "Prüfung", approved: "Freigegeben", processing: "Verarbeitung", completed: "Abgeschlossen", failed: "Fehlgeschlagen", cancelled: "Abgebrochen" };
