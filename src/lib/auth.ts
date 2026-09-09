import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  requireTenant,
  scopeOf,
  type Tenant,
  type TenantScope,
} from "@/lib/tenant";
import { verifyPassword } from "./password";
import {
  SESSION_COOKIE,
  cookieOptions,
  hashToken,
  newToken,
} from "./session-token";
import type { UserRole } from "./roles";

const SESSION_DAYS = 30;

/** Aus users.ts weitergereicht, damit Aufrufer nur ein Modul kennen muessen. */
export type { UserRole };

export type AdminUser = {
  id: number;
  username: string;
  role: UserRole;
  tenant: Tenant;
  scope: TenantScope;
};

async function createSession(tenantId: number, userId: number): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(sessions)
    .values({ id: hashToken(token), tenantId, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function login(
  username: string,
  password: string,
): Promise<boolean> {
  const tenant = await requireTenant();
  // Benutzernamen sind nur je Verein eindeutig: "vorstand" darf es in jedem
  // Verein geben. Deshalb gehoert der Verein zwingend in die Abfrage.
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.username, username)));
  if (!user) return false;
  if (!(await verifyPassword(password, user.passwordHash))) return false;
  await createSession(tenant.id, user.id);
  // Gelegentlich abgelaufene Sessions aufräumen
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/*
 * cache(): das Adminlayout und die jeweilige Seite verlangen beide den
 * angemeldeten Benutzer. Ohne die Deduplizierung liefe der Session-Join pro
 * Seitenaufruf doppelt.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tenant = await requireTenant();
  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(sessions)
    .innerJoin(
      users,
      and(eq(sessions.userId, users.id), eq(users.tenantId, tenant.id)),
    )
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        // Doppelt gemoppelt mit Absicht: selbst wenn der Join oben durch einen
        // Refactor kaputtgeht, bleibt die Session an ihren Verein gebunden.
        eq(sessions.tenantId, tenant.id),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  // Der Verein wird mitgegeben, damit Aufrufer fuer eine Tarifpruefung nicht
  // erneut requireTenant() bemuehen muessen.
  return { ...row, tenant, scope: scopeOf(tenant.id) };
});

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * Fuer alles, was den ganzen Verein betrifft: Vereinsdaten und Benutzer.
 *
 * Bewusst redirect statt forbidden(): forbidden() verlangt das experimentelle
 * Flag authInterrupts, und ein experimentelles Flag fuer eine Kernfunktion ist
 * in einem absichtlich abhaengigkeitsarmen Projekt der falsche Handel.
 * notFound() waere ebenfalls moeglich, aber fuer die Zielgruppe grausam:
 * "Seite nicht gefunden", obwohl sie eben noch im Menue stand.
 *
 * redirect funktioniert gleichermassen in Server Components und Server
 * Actions, eine Funktion deckt also beide Faelle ab.
 */
export async function requireOwner(): Promise<AdminUser> {
  const user = await requireAdmin();
  if (user.role !== "owner") redirect("/admin/keine-berechtigung");
  return user;
}

export async function recheckOwnerPassword(user: AdminUser, password: string): Promise<boolean> {
 if (user.role !== "owner" || password.length > 200) return false;
 const [account] = await db.select().from(users).where(and(eq(users.id, user.id), eq(users.tenantId, user.tenant.id)));
 return Boolean(account && await verifyPassword(password, account.passwordHash));
}
