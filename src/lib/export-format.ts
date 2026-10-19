import { mailTemplates } from "./mail-render";
import { locationSchema } from "./location-rules";
import { bankSchema, donationCopySchema } from "./donation-rules";
import { websiteStateSchema } from "./website/schema";
import { profileSchema } from "./animal-profile-fields";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { animalImages, animals, inquiries, inquiryReplies, posts, tenantSettings } from "@/db/schema";

const dates = { createdAt: z.coerce.date(), updatedAt: z.coerce.date() };
export const exportSchema = z.object({
  format: z.literal("pfotenweb-self-hosted"),
  version: z.literal(2),
  exportedAt: z.coerce.date(),
  settings: createSelectSchema(tenantSettings, { updatedAt: z.coerce.date(), mailTemplate: z.enum(mailTemplates).default("klassisch"), location: locationSchema.nullable().default(null), website: websiteStateSchema.nullable().default(null), websiteRevision: z.number().int().nonnegative().default(0), websiteMedia: z.array(z.object({url:z.string(),createdAt:z.string()})).default([]), visitorAddress: z.enum(["sie","du"]).default("sie"), adminAddress: z.enum(["sie","du"]).default("sie"), animationsEnabled: z.boolean().default(true), facts: z.array(z.object({ value: z.string().max(100), label: z.string().max(200) })).max(50).nullable(), colorPrimary: z.string().regex(/^#[a-fA-F0-9]{6}$/), colorAccent: z.string().regex(/^#[a-fA-F0-9]{6}$/) }).omit({ tenantId: true }).strict(),
  animals: z.array(createSelectSchema(animals, { ...dates, profile: profileSchema.default({}), revision: z.number().int().nonnegative().default(0) }).omit({ tenantId: true, publicId: true }).strict()).max(100_000),
  images: z.array(createSelectSchema(animalImages).omit({ tenantId: true }).strict()).max(500_000),
  posts: z.array(createSelectSchema(posts, dates).omit({ tenantId: true }).strict()).max(100_000),
  inquiries: z.array(createSelectSchema(inquiries, { createdAt: z.coerce.date(), resolvedAt: z.coerce.date().nullable() }).omit({ tenantId: true }).strict()).max(500_000),
  inquiryReplies: z.array(createSelectSchema(inquiryReplies, { createdAt: z.coerce.date(), sentAt: z.coerce.date().nullable(), deliveryStatus: z.enum(["sending", "sent", "failed", "uncertain", "imported"]) }).omit({ tenantId: true, requestId: true }).strict()).max(500000).default([]),
  donations: bankSchema.and(donationCopySchema).nullable().default(null),
  profiles: z.array(z.object({ username: z.string().max(100), displayName: z.string().max(80).nullable(), teamTitle: z.string().max(100).nullable(), bio: z.string().max(500).nullable(), avatar: z.string().nullable() }).strict()).max(10000).default([]),
  files: z.array(z.object({ name: z.string().regex(/^[a-f0-9]{64}\.(jpg|png|webp)$/), bytes: z.number().int().nonnegative().max(5 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(500_000),
}).strict();
export type ExportData = z.infer<typeof exportSchema>;
