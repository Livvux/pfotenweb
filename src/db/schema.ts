import type { MailTemplate } from "@/lib/mail-render";
import type { ShelterLocation } from "@/lib/location-rules";
import type { WebsiteState, WebsiteMedia } from "@/lib/website/schema";
import type { AnimalProfile } from "@/lib/animal-profile-fields";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Einzelner Verein                                                        */
/* -------------------------------------------------------------------------- */

// One association per installation, enforced by PostgreSQL.
export const tenants = pgTable("association", {
  id: integer("id").primaryKey().default(1),
}, (t) => [check("association_singleton", sql`${t.id} = 1`)]);

/** Alles, was heute noch als Text im Code steht. Ein Datensatz je Verein. */
export const tenantSettings = pgTable("association_settings", {
  tenantId: integer("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Identitaet
  orgName: varchar("org_name", { length: 160 }).notNull(),
  shortName: varchar("short_name", { length: 60 }).notNull(),
  legalForm: varchar("legal_form", { length: 40 }),
  foundedYear: integer("founded_year"),
  tagline: varchar("tagline", { length: 200 }),

  // Startseite
  heroHeadline: varchar("hero_headline", { length: 200 }).notNull(),
  heroSubline: text("hero_subline"),
  heroImageUrl: text("hero_image_url"),

  // Kontakt
  street: varchar("street", { length: 120 }),
  postalCode: varchar("postal_code", { length: 12 }),
  city: varchar("city", { length: 80 }),
  phone: varchar("phone", { length: 40 }),
  publicEmail: varchar("public_email", { length: 160 }),
  openingHours: text("opening_hours"),
  contactNotifyEmail: varchar("contact_notify_email", { length: 160 }),

  // Impressum
  representedBy: text("represented_by"),
  registerCourt: varchar("register_court", { length: 120 }),
  registerNumber: varchar("register_number", { length: 40 }),
  taxNote: text("tax_note"),

  // Vereinsseite
  aboutIntro: text("about_intro"),
  aboutWork: text("about_work"),
  aboutSupport: text("about_support"),
  facts: jsonb("facts").$type<{ value: string; label: string }[]>(),

  mailTemplate: varchar("mail_template", { length: 16 }).$type<MailTemplate>().notNull().default("klassisch"),
  location: jsonb("location").$type<ShelterLocation>(),
  visitorAddress: varchar("visitor_address", { length: 3 }).notNull().default("sie"),
  adminAddress: varchar("admin_address", { length: 3 }).notNull().default("sie"),
  animationsEnabled: boolean("animations_enabled").notNull().default(true),
  website: jsonb("website").$type<WebsiteState>(),
  websiteRevision: integer("website_revision").notNull().default(0),
  websiteMedia: jsonb("website_media").$type<WebsiteMedia[]>().notNull().default([]),
  // Erscheinungsbild
  logoUrl: text("logo_url"),
  colorPrimary: varchar("color_primary", { length: 9 }).notNull().default("#1e4334"),
  colorAccent: varchar("color_accent", { length: 9 }).notNull().default("#e4a44c"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/* Benutzer und Sessions                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Zwei Rollen, nicht drei.
 *
 * Der reale Bedarf eines Vereins ist genau einer: die neue Gassigeherin soll
 * Tiere pflegen duerfen, aber nicht das Impressum aendern und niemanden
 * aussperren koennen. Jede weitere Rolle vervielfacht die Matrix, und
 * Ehrenamtliche koennten den Unterschied dann nicht mehr erklaeren.
 */
export const userRoleEnum = pgEnum("user_role", ["owner", "editor"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 50 }).notNull(),
    passwordHash: text("password_hash").notNull().default(""),
    name: varchar("name", { length: 160 }).notNull().default(""),
    email: text("email").notNull().default(""),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    displayUsername: varchar("display_username", { length: 50 }).notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    displayName: varchar("display_name", { length: 80 }),
    profileRole: varchar("profile_role", { length: 100 }),
    tourCompletedAt: timestamp("tour_completed_at", { withTimezone: true }),
    inquiriesSeenAt: timestamp("inquiries_seen_at", { withTimezone: true }),
    bio: text("bio"),
    profileImage: text("profile_image"),
    recoveryEmail: varchar("recovery_email", { length: 160 }),
    recoveryEmailVerifiedAt: timestamp("recovery_email_verified_at", { withTimezone: true }),
    // Der Default ist bewusst die kleinere Rolle: eine neu angelegte Zeile darf
    // im Zweifel zu wenig duerfen, nie zu viel.
    role: userRoleEnum("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // Benutzernamen sind nur noch je Verein eindeutig: "vorstand" darf es in
  // jedem Verein einmal geben.
  (t) => [unique("users_tenant_username_uq").on(t.tenantId, t.username), unique("users_email_uq").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    // Denormalisiert aus users. Wird beim Lesen zusaetzlich zum Join geprueft,
    // damit eine Session auch bei einem Refactor an ihren Verein gebunden bleibt.
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_tenant_idx").on(t.tenantId, t.id),
  ],
);

export const loginAttempts = pgTable("login_attempts", {
  key: varchar("key", { length: 200 }).primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

/* -------------------------------------------------------------------------- */
/* Inhalte                                                                    */
/* -------------------------------------------------------------------------- */

export const speciesEnum = pgEnum("species", [
  "hund",
  "katze",
  "kleintier",
  "vogel",
  "sonstiges",
]);

export const statusEnum = pgEnum("animal_status", [
  "vermittelbar",
  "reserviert",
  "vermittelt",
]);

export const animals = pgTable(
  "animals",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").notNull().defaultRandom().unique(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 140 }).notNull(),
    profile: jsonb("profile").$type<AnimalProfile>().notNull().default({}),
    revision: integer("revision").notNull().default(0),
    name: varchar("name", { length: 80 }).notNull(),
    species: speciesEnum("species").notNull(),
    breed: varchar("breed", { length: 80 }),
    sex: varchar("sex", { length: 1 }).notNull().default("u"),
    birthYear: integer("birth_year"),
    size: varchar("size", { length: 20 }),
    description: text("description").notNull(),
    status: statusEnum("status").notNull().default("vermittelbar"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("animals_tenant_slug_uq").on(t.tenantId, t.slug),
    // Voraussetzung fuer den zusammengesetzten Fremdschluessel unten.
    unique("animals_tenant_id_uq").on(t.tenantId, t.id),
    index("animals_tenant_species_idx").on(t.tenantId, t.species),
    index("animals_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

export const animalImages = pgTable(
  "animal_images",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    animalId: integer("animal_id").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    // Zusammengesetzter Fremdschluessel: Postgres verweigert es, ein Bild an ein
    // Tier eines anderen Vereins zu haengen, selbst wenn der Code es versucht.
    foreignKey({
      columns: [t.tenantId, t.animalId],
      foreignColumns: [animals.tenantId, animals.id],
      name: "animal_images_tenant_animal_fk",
    }).onDelete("cascade"),
    // Fuehrt mit tenant_id, weil jede Abfrage den Verein filtert. Ein Index nur
    // auf animal_id wuerde dabei nicht greifen, und Postgres legt fuer
    // Fremdschluessel von sich aus keinen an.
    index("animal_images_tenant_animal_idx").on(t.tenantId, t.animalId),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("posts_tenant_slug_uq").on(t.tenantId, t.slug),
    index("posts_tenant_published_idx").on(t.tenantId, t.published),
  ],
);

export const inquiries = pgTable(
  "inquiries",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    subject: varchar("subject", { length: 180 }),
    message: text("message").notNull(),
    animalId: integer("animal_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.animalId],
      foreignColumns: [animals.tenantId, animals.id],
      name: "inquiries_tenant_animal_fk",
    }).onDelete("no action"),
    unique("inquiries_tenant_id_uq").on(t.tenantId, t.id),
    index("inquiries_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

/** Deletion intent survives a process crash after committing a content change. */
export const mediaDeletions = pgTable("media_deletions", {
  url: text("url").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const donationSettings = pgTable("donation_settings", {
  tenantId: integer("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  heading: varchar("heading", { length: 120 }).notNull().default("Gemeinsam Tieren helfen"),
  introduction: text("introduction").notNull().default(""),
  receiptNote: text("receipt_note").notNull().default(""),
  accountHolder: varchar("account_holder", { length: 160 }).notNull().default(""),
  iban: varchar("iban", { length: 34 }).notNull().default(""),
  bic: varchar("bic", { length: 11 }).notNull().default(""),
  bankName: varchar("bank_name", { length: 160 }).notNull().default(""),
  purpose: varchar("purpose", { length: 140 }).notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inquiryReplies = pgTable("inquiry_replies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  inquiryId: integer("inquiry_id").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  authorName: varchar("author_name", { length: 50 }).notNull(),
  body: text("body").notNull(),
  deliveryStatus: varchar("delivery_status", { length: 16 }).$type<"sending" | "sent" | "failed" | "uncertain" | "imported">().notNull().default("imported"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique("inquiry_replies_request_uq").on(t.tenantId, t.requestId),
  foreignKey({ columns: [t.tenantId, t.inquiryId], foreignColumns: [inquiries.tenantId, inquiries.id] }).onDelete("cascade"),
  index("inquiry_replies_inquiry_idx").on(t.tenantId, t.inquiryId),
]);

// Separate tables keep legacy sessions inert without deleting existing accounts.
export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reauthenticatedAt: timestamp("reauthenticated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("auth_sessions_user_idx").on(t.userId)]);
export const authAccounts = pgTable("auth_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("auth_accounts_user_provider_uq").on(t.userId, t.providerId)]);
export const authVerifications = pgTable("auth_verifications", {
  id: serial("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("auth_verifications_identifier_idx").on(t.identifier)]);
export const authPasskeys = pgTable("auth_passkeys", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name"), publicKey: text("public_key").notNull(), credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull().default(0), deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull().default(false), transports: text("transports"), aaguid: text("aaguid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SecurityChallengePayload = { username?: string; role?: "owner" | "editor"; permissions?: string[]; invitedBy?: number };
export const securityChallenges = pgTable("security_challenges", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 16 }).$type<"login" | "reauth" | "email" | "invite" | "reset">().notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  payload: jsonb("payload").$type<SecurityChallengePayload>().notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("security_challenges_user_idx").on(t.userId)]);

export const contentImportRuns = pgTable("content_import_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  state: varchar("state", { length: 20 }).notNull().default("preparing"),
  format: varchar("format", { length: 16 }).$type<"csv" | "wordpress">().notNull(),
  source: text("source"),
  sourceName: varchar("source_name", { length: 200 }).notNull(),
  namespace: varchar("namespace", { length: 200 }).notNull(),
  mapping: jsonb("mapping").$type<import("../lib/content-import/types").Mapping>(),
  error: text("error"),
  approvedBy: integer("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("content_import_runs_tenant_id_uq").on(t.tenantId, t.id), index("content_import_runs_state_idx").on(t.state, t.updatedAt)]);

export const contentImportCandidates = pgTable("content_import_candidates", {
  id: serial("id").primaryKey(), tenantId: integer("tenant_id").notNull(), runId: integer("run_id").notNull(),
  sourceKey: text("source_key").notNull(),
  raw: jsonb("raw").$type<import("../lib/content-import/types").SourceRow>().notNull(),
  draft: jsonb("draft").$type<import("../lib/content-import/types").Draft>().notNull(),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  selected: boolean("selected").notNull().default(false),
  textConfirmed: boolean("text_confirmed").notNull().default(false),
  previousText: text("previous_text"),
  duplicate: boolean("duplicate").notNull().default(false),
  state: varchar("state", { length: 16 }).notNull().default("pending"),
  error: text("error"), targetId: integer("target_id"),
}, t => [unique("content_import_candidates_tenant_id_uq").on(t.tenantId, t.id),
  foreignKey({ columns: [t.tenantId, t.runId], foreignColumns: [contentImportRuns.tenantId, contentImportRuns.id] }).onDelete("cascade"),
  index("content_import_candidates_run_idx").on(t.tenantId, t.runId)]);

export const contentImportImages = pgTable("content_import_images", {
  id: serial("id").primaryKey(), tenantId: integer("tenant_id").notNull(), candidateId: integer("candidate_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  stageKey: text("stage_key"), targetKey: text("target_key"),
  state: varchar("state", { length: 16 }).notNull().default("pending"),
  omitted: boolean("omitted").notNull().default(false), bytes: integer("bytes").notNull().default(0), error: text("error"),
}, t => [foreignKey({ columns: [t.tenantId, t.candidateId], foreignColumns: [contentImportCandidates.tenantId, contentImportCandidates.id] }).onDelete("cascade"),
  index("content_import_images_candidate_idx").on(t.tenantId, t.candidateId)]);

export const contentImportSources = pgTable("content_import_sources", {
  id: serial("id").primaryKey(), tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sourceHash: varchar("source_hash", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 16 }).notNull(), targetId: integer("target_id"),
}, t => [unique("content_import_sources_tenant_hash_uq").on(t.tenantId, t.sourceHash)]);
