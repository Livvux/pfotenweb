import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, authSessions } from "@/db/schema";
import type { TenantScope } from "./tenant";
import { canAccess, type Area } from "./roles";

/** Call after locking the association, in the same transaction as the write. */
export async function assertCurrentAccess(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: { id: number; scope: TenantScope }, area: Area | "owner" | "self"): Promise<void> {
  const [current] = await tx.select({ active: users.active, role: users.role, permissions: users.permissions }).from(users)
    .where(and(eq(users.id, actor.id), eq(users.tenantId, actor.scope.tenantId)));
  if (!current?.active || (area === "self" ? false : area === "owner" ? current.role !== "owner" : !canAccess(current, area)))
    throw new Error("Der Zugriff wurde inzwischen entzogen. Bitte erneut anmelden.");
}

export async function assertFreshAuthentication(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: { id: number; sessionId: number }) {
  const [session] = await tx.select({ expiresAt: authSessions.expiresAt, reauthenticatedAt: authSessions.reauthenticatedAt }).from(authSessions).where(and(eq(authSessions.id, actor.sessionId), eq(authSessions.userId, actor.id)));
  if (!session || session.expiresAt <= new Date() || Date.now() - session.reauthenticatedAt.getTime() > 15 * 60_000)
    throw new Error("Bitte das Passwort oder einen frischen E-Mail-Code unter Konto bestätigen und die Aktion erneut ausführen.");
}
