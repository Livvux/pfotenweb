import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { animalImages, animals, inquiries, posts, tenantSettings } from "@/db/schema";

const dates = { createdAt: z.coerce.date(), updatedAt: z.coerce.date() };
export const exportSchema = z.object({
  format: z.literal("pfotenweb-single"),
  version: z.literal(1),
  exportedAt: z.coerce.date(),
  settings: createSelectSchema(tenantSettings, { updatedAt: z.coerce.date(), facts: z.array(z.object({ value: z.string().max(100), label: z.string().max(200) })).max(50).nullable(), colorPrimary: z.string().regex(/^#[a-fA-F0-9]{6}$/), colorAccent: z.string().regex(/^#[a-fA-F0-9]{6}$/) }).omit({ tenantId: true }).strict(),
  animals: z.array(createSelectSchema(animals, dates).omit({ tenantId: true }).strict()).max(100_000),
  images: z.array(createSelectSchema(animalImages).omit({ tenantId: true }).strict()).max(500_000),
  posts: z.array(createSelectSchema(posts, dates).omit({ tenantId: true }).strict()).max(100_000),
  inquiries: z.array(createSelectSchema(inquiries, { createdAt: z.coerce.date(), resolvedAt: z.coerce.date().nullable() }).omit({ tenantId: true }).strict()).max(500_000),
  files: z.array(z.object({ name: z.string().regex(/^[a-f0-9]{64}\.(jpg|png|webp)$/), bytes: z.number().int().nonnegative().max(5 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(500_000),
}).strict();
export type ExportData = z.infer<typeof exportSchema>;
