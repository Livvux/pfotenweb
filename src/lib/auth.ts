import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, authSessions, tenants } from "@/db/schema";
import { requireTenant, scopeOf, type Tenant, type TenantScope } from "./tenant";
import { auth } from "./auth-config";
import { verifyPassword } from "./password";
import { assertCurrentAccess, assertFreshAuthentication } from "./access";
import { credentialHash } from "./auth-users";
import { canAccess, type Area, type UserRole } from "./roles";
export type { UserRole };
export type AdminUser = { id: number; username: string; role: UserRole; permissions: string[]; tenant: Tenant; scope: TenantScope; sessionId: number; reauthenticatedAt: Date };
export async function login(username: string, password: string): Promise<boolean> {
  const [user] = await db.select({ active: users.active }).from(users).where(and(eq(users.tenantId, 1), eq(users.username, username)));
  if (!user?.active) return false;
  try {
    await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
    return true;
  } catch { return false; }
}
export async function logout(): Promise<void> { await auth.api.signOut({ headers: await headers() }); }
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const tenant = await requireTenant();
  const [row] = await db.select({ user: { id: users.id, username: users.username, role: users.role, permissions: users.permissions, active: users.active }, sessionId: authSessions.id, reauthenticatedAt: authSessions.reauthenticatedAt }).from(users)
    .innerJoin(authSessions, and(eq(authSessions.userId, users.id), eq(authSessions.id, Number(session.session.id))))
    .where(and(eq(users.id, Number(session.user.id)), eq(users.tenantId, tenant.id), gt(authSessions.expiresAt, new Date())));
  if (!row?.user.active) return null;
  return { ...row.user, tenant, scope: scopeOf(tenant.id), sessionId: row.sessionId, reauthenticatedAt: row.reauthenticatedAt };
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

export async function authorizeOwnerExport(user: AdminUser, password: string): Promise<boolean> {
  if (password.length > 200) return false;
  const hash = await credentialHash(user.id);
  const validPassword = Boolean(hash && await verifyPassword(password, hash));
  if (hash && !validPassword) return false;
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, user.scope.tenantId)).for("update");
      await assertCurrentAccess(tx, user, "owner");
      if (validPassword) {
        if (await credentialHash(user.id, tx) !== hash) throw new Error("Passwort wurde inzwischen geändert.");
      } else await assertFreshAuthentication(tx, user);
    });
    return true;
  } catch { return false; }
}

export async function requireArea(area: Area): Promise<AdminUser> {
  const user = await requireAdmin();
  if (!canAccess(user, area)) redirect("/admin/keine-berechtigung");
  return user;
}
