import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantSettings } from "@/db/schema";
export type Tenant = typeof tenants.$inferSelect;
export type TenantSettings = typeof tenantSettings.$inferSelect;
declare const verified: unique symbol;
export type TenantScope = { tenantId: number; readonly [verified]: true };
export function scopeOf(id: number): TenantScope { if (id !== 1) throw new Error("Nur ein Verein ist erlaubt."); return { tenantId: 1 } as TenantScope; }
export const getCurrentTenant = cache(async () => {
  await headers();
  const [association] = await db.select().from(tenants).where(eq(tenants.id, 1));
  return association ?? null;
});
export async function requireTenant(): Promise<Tenant> {
  const association = await getCurrentTenant();
  if (!association) notFound();
  return association;
}
export const requireActiveTenant = requireTenant;
export async function requireScope(): Promise<TenantScope> { return scopeOf((await requireTenant()).id); }
export const requireActiveScope = requireScope;
/**
 * Die Anschrift des Vereins als Zeilen, leere Felder fallen weg.
 *
 * Steht an einer Stelle, weil sie in Footer, Kontaktseite, Impressum und
 * Datenschutzerklaerung gebraucht wird. Ein Verein, der nur eine Stadt
 * eintraegt, soll nicht in vier Dateien gesondert behandelt werden.
 */
export function addressLines(settings: TenantSettings): string[] {
  return [
    settings.street,
    [settings.postalCode, settings.city].filter(Boolean).join(" "),
  ].filter((line): line is string => Boolean(line));
}

export const getSettings = cache(
  async (tenantId: number): Promise<TenantSettings | null> => {
    const [row] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    return row ?? null;
  },
);

/**
 * Die Einstellungen des angemeldeten Vereins, oder 404.
 *
 * Fuer die sechs Unterseiten unter /admin/verein, die alle mit derselben
 * Zeile beginnen.
 */
export async function requireOwnSettings(
  scope: TenantScope,
): Promise<TenantSettings> {
  const settings = await getSettings(scope.tenantId);
  if (!settings) notFound();
  return settings;
}

/** Verein plus Einstellungen in einem Rutsch, fuer Layouts und Metadata. */
export async function requireTenantWithSettings(): Promise<{
  tenant: Tenant;
  settings: TenantSettings;
  scope: TenantScope;
}> {
  const tenant = await requireActiveTenant();
  const settings = await getSettings(tenant.id);
  if (!settings) notFound();
  return { tenant, settings, scope: scopeOf(tenant.id) };
}

export async function getTenantSiteUrl(_association?: Tenant): Promise<string> {
  void _association;
  return process.env.SITE_URL ?? "http://localhost:3000";
}
