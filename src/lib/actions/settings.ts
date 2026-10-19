"use server";

import { mailTemplates } from "@/lib/mail-render";
import { assertCurrentAccess } from "@/lib/access";
import { syncWebsiteColors, WebsiteColorConflictError } from "@/lib/website/legacy";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenantSettings, tenants } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { text, zodErrorState, type FormState } from "@/lib/form";
import { deleteFile, saveImage } from "@/lib/storage";
import type { TenantScope } from "@/lib/tenant";

/*
 * Die Vereinsdaten liegen in EINER Tabelle, werden aber in sechs kleinen
 * Formularen gepflegt. Jedes hat seine eigene Aktion und sein eigenes Schema.
 *
 * Bewusst keine generische updateSettings(abschnitt, ...): der Abschnitt kaeme
 * dann aus dem Formular, also aus der Hand des Clients, und die Zuordnung von
 * Feld zu Schema waere nur noch zur Laufzeit pruefbar.
 */

/**
 * Leere Eingaben werden zu null, nicht zum leeren String.
 *
 * Die oeffentlichen Seiten sichern optionale Felder mit `&&` ab. Ein leerer
 * String ist zwar falsy, landet aber als "" in der Datenbank und macht aus
 * `settings.phone && ...` bei jeder spaeteren Pruefung eine Stolperstelle.
 */
const optionalerText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .transform((v) => (v.length > 0 ? v : null))
    .nullable();

const optionaleEmail = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .refine(
      (v) => v === null || z.email().safeParse(v).success,
      "Bitte eine gültige E-Mail-Adresse angeben.",
    );

const AKTUELLES_JAHR = new Date().getFullYear();

const hexFarbe = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Bitte eine Farbe im Format #1e4334 angeben.");

/** Teil-UPDATE auf die eigene Zeile. Der Verein steht in der WHERE-Klausel. */
async function saveSettings(t: TenantScope, actorId: number, values: Partial<typeof tenantSettings.$inferInsert>): Promise<FormState | null> {
  return db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, t.tenantId)).for("update");
    try { await assertCurrentAccess(tx, { id: actorId, scope: t }, "owner"); }
    catch { return { error: "Der Zugriff wurde inzwischen entzogen. Bitte erneut anmelden." }; }
    const [current] = await tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, t.tenantId)).for("update");
    if (!current) return nichtGefunden;
    const contentFields = ["heroHeadline", "heroSubline", "heroImageUrl", "aboutIntro", "aboutWork", "aboutSupport", "facts"] as const;
    if (current.website && contentFields.some(key => key in values && JSON.stringify(values[key]) !== JSON.stringify(current[key])))
      return { error: "Diese Inhalte werden im Website-Editor gepflegt. Bitte dort den Entwurf bearbeiten und veröffentlichen." };
    const website = syncWebsiteColors(current.website, values, current);
    const changedWebsite = JSON.stringify(website) !== JSON.stringify(current.website);
    await tx.update(tenantSettings).set({ ...values, ...(changedWebsite ? { website, websiteRevision: current.websiteRevision + 1 } : {}), updatedAt: new Date() })
      .where(eq(tenantSettings.tenantId, t.tenantId));
    return null;
  });
}

/*
 * Name, Logo und Farben stecken in Header, Footer und Metadata JEDER Seite.
 * Deshalb der ganze Baum und nicht einzelne Pfade.
 */
function revalidateSite(): void {
  revalidatePath("/", "layout");
}

const gespeichert: FormState = { success: true };
const nichtGefunden: FormState = {
  error: "Die Vereinsdaten wurden nicht gefunden.",
};

/* -------------------------------------------------------------------------- */
/* Verein und Kurzname                                                        */
/* -------------------------------------------------------------------------- */

const identitaetSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(3, "Der Vereinsname ist zu kurz.")
    .max(160),
  shortName: z
    .string()
    .trim()
    .min(2, "Der Kurzname ist zu kurz.")
    .max(60),
  legalForm: optionalerText(40),
  foundedYear: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? Number(v) : null))
    .refine(
      (v) =>
        v === null || (Number.isInteger(v) && v >= 1800 && v <= AKTUELLES_JAHR),
      `Bitte ein Jahr zwischen 1800 und ${AKTUELLES_JAHR} angeben.`,
    ),
  tagline: optionalerText(200),
  visitorAddress: z.enum(["sie", "du"]),
  adminAddress: z.enum(["sie", "du"]),
  animationsEnabled: z.boolean(),
});

export async function updateVereinIdentitaet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = identitaetSchema.safeParse({
    orgName: text(formData, "orgName"),
    shortName: text(formData, "shortName"),
    legalForm: text(formData, "legalForm"),
    foundedYear: text(formData, "foundedYear"),
    tagline: text(formData, "tagline"),
    visitorAddress: formData.get("visitorAddress") ?? "sie",
    adminAddress: formData.get("adminAddress") ?? "sie",
    animationsEnabled: formData.get("animationsEnabled") === "on",
  });
  if (!parsed.success) return zodErrorState(parsed.error);
  const saveError = await saveSettings(scope, actor.id, parsed.data);
  if (saveError) return saveError;
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Kontakt                                                                    */
/* -------------------------------------------------------------------------- */

const kontaktSchema = z.object({
  street: optionalerText(120),
  postalCode: optionalerText(12),
  city: optionalerText(80),
  phone: optionalerText(40),
  publicEmail: optionaleEmail(160),
  openingHours: optionalerText(2000),
  contactNotifyEmail: optionaleEmail(160),
});

export async function updateVereinKontakt(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = kontaktSchema.safeParse({
    street: text(formData, "street"),
    postalCode: text(formData, "postalCode"),
    city: text(formData, "city"),
    phone: text(formData, "phone"),
    publicEmail: text(formData, "publicEmail"),
    openingHours: text(formData, "openingHours"),
    contactNotifyEmail: text(formData, "contactNotifyEmail"),
  });
  if (!parsed.success) return zodErrorState(parsed.error);
  const saveError = await saveSettings(scope, actor.id, parsed.data);
  if (saveError) return saveError;
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Startseite                                                                 */
/* -------------------------------------------------------------------------- */

const startseiteSchema = z.object({
  heroHeadline: z
    .string()
    .trim()
    .min(10, "Die Überschrift ist zu kurz.")
    .max(200),
  heroSubline: optionalerText(2000),
});

export async function updateVereinStartseite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = startseiteSchema.safeParse({
    heroHeadline: text(formData, "heroHeadline"),
    heroSubline: text(formData, "heroSubline"),
  });
  if (!parsed.success) return zodErrorState(parsed.error);

  const bild = await bildFeld(scope, formData, "heroImage");
  if (bild.error) return { error: bild.error, fieldErrors: { heroImage: bild.error } };

  const saveError = await saveSettings(scope, actor.id, { ...parsed.data, ...(bild.set !== undefined ? { heroImageUrl: bild.set } : {}) });
  if (saveError) {
    if (bild.set) await deleteFile(scope.tenantId, bild.set);
    return saveError;
  }
  if (bild.aufraeumen) await deleteFile(scope.tenantId, bild.aufraeumen);
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Impressum                                                                  */
/* -------------------------------------------------------------------------- */

const impressumSchema = z.object({
  representedBy: optionalerText(500),
  registerCourt: optionalerText(120),
  registerNumber: optionalerText(40),
  taxNote: optionalerText(1000),
});

export async function updateVereinImpressum(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = impressumSchema.safeParse({
    representedBy: text(formData, "representedBy"),
    registerCourt: text(formData, "registerCourt"),
    registerNumber: text(formData, "registerNumber"),
    taxNote: text(formData, "taxNote"),
  });
  if (!parsed.success) return zodErrorState(parsed.error);
  const saveError = await saveSettings(scope, actor.id, parsed.data);
  if (saveError) return saveError;
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Ueber uns                                                                  */
/* -------------------------------------------------------------------------- */

const ueberUnsSchema = z.object({
  aboutIntro: optionalerText(4000),
  aboutWork: optionalerText(4000),
  aboutSupport: optionalerText(4000),
});

/** Vier feste Zeilenpaare. Paare, bei denen etwas fehlt, fallen weg. */
function factsAus(formData: FormData): { value: string; label: string }[] {
  const werte = formData.getAll("factValue").map((v) => String(v).trim());
  const labels = formData.getAll("factLabel").map((v) => String(v).trim());
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < Math.min(werte.length, labels.length); i++) {
    if (werte[i] && labels[i]) out.push({ value: werte[i], label: labels[i] });
  }
  return out;
}

export async function updateVereinUeberUns(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = ueberUnsSchema.safeParse({
    aboutIntro: text(formData, "aboutIntro"),
    aboutWork: text(formData, "aboutWork"),
    aboutSupport: text(formData, "aboutSupport"),
  });
  if (!parsed.success) return zodErrorState(parsed.error);
  const facts = factsAus(formData);
  const saveError = await saveSettings(scope, actor.id, { ...parsed.data, facts: facts.length > 0 ? facts : null });
  if (saveError) return saveError;
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Erscheinungsbild                                                           */
/* -------------------------------------------------------------------------- */

const erscheinungSchema = z.object({
  colorPrimary: hexFarbe,
  colorAccent: hexFarbe,
  mailTemplate: z.enum(mailTemplates),
});

export async function updateVereinErscheinungsbild(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = erscheinungSchema.safeParse({
    colorPrimary: text(formData, "colorPrimary"),
    colorAccent: text(formData, "colorAccent"),
    mailTemplate: formData.get("mailTemplate") ?? "klassisch",
  });
  if (!parsed.success) return zodErrorState(parsed.error);

  const bild = await bildFeld(scope, formData, "logo");
  if (bild.error) return { error: bild.error, fieldErrors: { logo: bild.error } };

  try {
    const saveError = await saveSettings(scope, actor.id, { ...parsed.data, ...(bild.set !== undefined ? { logoUrl: bild.set } : {}) });
    if (saveError) { if (bild.set) await deleteFile(scope.tenantId, bild.set); return saveError; }
  } catch (error) {
    if (bild.set) await deleteFile(scope.tenantId, bild.set);
    if (error instanceof WebsiteColorConflictError) return { error: error.message };
    throw error;
  }
  if (bild.aufraeumen) await deleteFile(scope.tenantId, bild.aufraeumen);
  revalidateSite();
  return gespeichert;
}

/* -------------------------------------------------------------------------- */
/* Gemeinsame Bildbehandlung fuer Logo und Startbild                          */
/* -------------------------------------------------------------------------- */

/**
 * Wertet ein Bildfeld samt zugehoeriger „entfernen“-Checkbox aus.
 *
 * `set` ist undefined, wenn nichts zu aendern ist. Nur so bleibt ein Speichern
 * ohne Dateiauswahl das, was der Nutzer erwartet: das vorhandene Bild bleibt.
 *
 * Die alte Datei wird erst geloescht, NACHDEM das UPDATE durch ist. Andernfalls
 * verschwindet bei einem Fehler im UPDATE das Bild von der Platte, waehrend die
 * Datenbank weiter darauf zeigt.
 */
async function bildFeld(
  scope: TenantScope,
  formData: FormData,
  feld: string,
): Promise<{ set?: string | null; aufraeumen?: string; error?: string }> {
  const alt = String(formData.get(`${feld}Current`) ?? "") || undefined;
  const entfernen = formData.get(`${feld}Remove`) === "on";
  const datei = formData.get(feld);
  const file = datei instanceof File ? datei : null;

  if (file && file.size > 0) {
    const { url, error } = await saveImage(scope.tenantId, file);
    if (error) return { error };
    return { set: url ?? null, aufraeumen: alt };
  }
  if (entfernen) return { set: null, aufraeumen: alt };
  return {};
}
