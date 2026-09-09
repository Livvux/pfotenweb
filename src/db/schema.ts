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
    passwordHash: text("password_hash").notNull(),
    // Der Default ist bewusst die kleinere Rolle: eine neu angelegte Zeile darf
    // im Zweifel zu wenig duerfen, nie zu viel.
    role: userRoleEnum("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // Benutzernamen sind nur noch je Verein eindeutig: "vorstand" darf es in
  // jedem Verein einmal geben.
  (t) => [unique("users_tenant_username_uq").on(t.tenantId, t.username)],
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
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 140 }).notNull(),
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
    }).onDelete("set null"),
    index("inquiries_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);
