import { z } from "zod";
import { exportSchema, type ExportData } from "./export-format";

const record = z.record(z.string(), z.unknown());
// Only reviewed archive envelopes are accepted. Additional sections remain
// opaque and are retained in the private source archive, never activated.
const envelope = z.object({
  format: z.literal("pfotenweb-single"), version: z.number().int().min(1).max(15), exportedAt: z.coerce.date(),
  settings: record, animals: z.array(record).max(100000), images: z.array(record).max(500000),
  posts: z.array(record).max(100000), inquiries: z.array(record).max(500000),
  files: z.array(z.object({ name: z.string().regex(/^[a-f0-9]{64}\.(jpg|png|webp|mp4|pdf)$/), bytes: z.number().int().nonnegative().max(50000000), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(500000),
}).passthrough();

/** Convert only the published common schema. Preserve the complete source separately. */
export function compatibleImport(input: unknown): { data: ExportData; files: z.infer<typeof envelope>["files"]; additional: string[] } {
  const native = exportSchema.safeParse(input);
  if (native.success) return { data: native.data, files: native.data.files, additional: [] };
  const source = envelope.parse(input);
  const additional = new Set<string>();
  function project<T extends z.ZodRawShape>(schema: z.ZodObject<T>, row: Record<string, unknown>, section: string) {
    for (const key of Object.keys(row)) if (!(key in schema.shape)) additional.add(`${section}.${key}`);
    return schema.strip().parse(row);
  }
  const settings = project(exportSchema.shape.settings, source.settings, "settings");
  const animals = source.animals.map(row => project(exportSchema.shape.animals.element, row, "animals"));
  const images = source.images.map(row => project(exportSchema.shape.images.element, row, "images"));
  const posts = source.posts.map(row => project(exportSchema.shape.posts.element, row, "posts"));
  const inquiries = source.inquiries.map(row => project(exportSchema.shape.inquiries.element, row, "inquiries"));
  for (const key of Object.keys(source)) if (!(key in exportSchema.shape)) additional.add(key);
  const used = new Set([settings.logoUrl, settings.heroImageUrl, ...images.map(image => image.url)].filter((url): url is string => !!url));
  const files = source.files.filter(file => used.has(`images/${file.name}`));
  if (files.length !== source.files.length) additional.add("files (zusätzliche Medien)");
  const data = exportSchema.parse({ format: source.format, version: 1, exportedAt: source.exportedAt, settings, animals, images, posts, inquiries, files });
  return { data, files: source.files, additional: [...additional].sort() };
}
