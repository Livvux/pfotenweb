"use server";

import { assertCurrentAccess, assertFreshAuthentication } from "@/lib/access";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenants, authSessions as sessions, users } from "@/db/schema";
import { requireAdmin, requireOwner } from "@/lib/auth";
import {
  idSchema,
  isUniqueViolation,
  text,
  zodErrorState,
  type FormState,
} from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createCredentialUser, credentialHash, setCredentialHash } from "@/lib/auth-users";
import { countOwners } from "@/lib/users";
import { areas } from "@/lib/roles";


/*
 * Benutzerverwaltung eines Vereins.
 *
 * Zwei Regeln zieht jede Aktion durch, weil ihr Bruch einen Verein dauerhaft
 * aussperrt: der letzte Verantwortliche kann weder herabgestuft noch geloescht
 * werden, und niemand kann sich selbst die eigenen Rechte nehmen.
 */

const benutzername = z
  .string()
  .trim()
  .min(3, "Der Benutzername ist zu kurz.")
  .max(50, "Der Benutzername ist zu lang.")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich, keine Leerzeichen.",
  );

const passwort = z
  .string()
  .min(8, "Das Passwort muss mindestens 8 Zeichen haben.")
  .max(200);

const rolle = z.enum(["owner", "editor"]);

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = z
    .object({ username: benutzername, password: passwort, role: rolle })
    .safeParse({
      username: text(formData, "username"),
      password: text(formData, "password"),
      role: text(formData, "role"),
    });
  if (!parsed.success) return zodErrorState(parsed.error);

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
      await assertCurrentAccess(tx, actor, "owner");
      await assertFreshAuthentication(tx, actor);
      await createCredentialUser(tx, {
      tenantId: scope.tenantId,
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const meldung = "Diesen Benutzernamen gibt es in Ihrem Verein schon.";
      return { error: meldung, fieldErrors: { username: meldung } };
    }
    throw err;
  }

  revalidatePath("/admin/team");
  return { success: true };
}

export async function changeUserRole(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const eigen = await requireOwner();
  const parsed = z
    .object({ userId: idSchema, role: rolle })
    .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return zodErrorState(parsed.error);

  if (parsed.data.userId === eigen.id) {
    return {
      error:
        "Die eigene Rolle lässt sich nicht ändern. Bitte eine andere verantwortliche Person darum bitten.",
    };
  }

  const fehler = await db.transaction(async (tx) => {
    await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, eigen.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, eigen, "owner");
    await assertFreshAuthentication(tx, eigen);
    // Zaehlung und UPDATE in derselben Transaktion: sonst stufen zwei
    // gleichzeitige Klicks beide verbliebenen Verantwortlichen herab.
    if (parsed.data.role === "editor") {
      if ((await countOwners(eigen.scope, parsed.data.userId, tx)) === 0) {
        return "Der letzte verantwortliche Zugang kann nicht herabgestuft werden.";
      }
    }
    const changed = await tx
      .update(users)
      .set({ role: parsed.data.role })
      .where(
        and(
          eq(users.tenantId, eigen.scope.tenantId),
          eq(users.id, parsed.data.userId),
        ),
      )
      .returning({ id: users.id });
    return changed.length === 0 ? "Benutzer nicht gefunden." : null;
  });
  if (fehler) return { error: fehler };

  revalidatePath("/admin/team");
  return { success: true };
}

export async function updateUserAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireOwner();
  const parsed = z.object({ userId: idSchema, permissions: z.array(z.enum(areas)), active: z.boolean() }).safeParse({
    userId: formData.get("userId"), permissions: formData.getAll("permissions"), active: formData.get("active") === "on",
  });
  if (!parsed.success) return zodErrorState(parsed.error);
  if (parsed.data.userId === actor.id) return { error: "Die eigenen Zugriffsrechte lassen sich hier nicht ändern." };
  const error = await db.transaction(async tx => {
    await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, actor.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "owner");
    await assertFreshAuthentication(tx, actor);
    const [target] = await tx.select().from(users).where(and(eq(users.id, parsed.data.userId), eq(users.tenantId, actor.scope.tenantId))).for("update");
    if (!target) return "Benutzer nicht gefunden.";
    if (!parsed.data.active && target.role === "owner" && await countOwners(actor.scope, target.id, tx) === 0) return "Der letzte verantwortliche Zugang muss aktiv bleiben.";
    await tx.update(users).set({ active: parsed.data.active, permissions: [...new Set(parsed.data.permissions)] }).where(eq(users.id, target.id));
    await tx.delete(sessions).where(eq(sessions.userId, target.id));
    return null;
  });
  if (error) return { error };
  revalidatePath("/admin/team");
  return { success: true };
}

export async function resetUserPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireOwner();
  const { scope } = actor;
  const parsed = z
    .object({ userId: idSchema, password: passwort })
    .safeParse({
      userId: formData.get("userId"),
      password: text(formData, "password"),
    });
  if (!parsed.success) return zodErrorState(parsed.error);

  const passwordHash = await hashPassword(parsed.data.password);
  const changed = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "owner");
    await assertFreshAuthentication(tx, actor);
    const rows = await tx.select({ id: users.id }).from(users).where(and(eq(users.tenantId, scope.tenantId), eq(users.id, parsed.data.userId)));
    if (rows.length) await setCredentialHash(tx, parsed.data.userId, passwordHash);
    await tx.delete(sessions).where(eq(sessions.userId, parsed.data.userId));
    return rows;
  });
  if (!changed.length) return { error: "Benutzer nicht gefunden." };

  revalidatePath("/admin/team");
  return { success: true };
}

export async function deleteUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const eigen = await requireOwner();
  const parsed = z.object({ userId: idSchema }).safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return zodErrorState(parsed.error);

  if (parsed.data.userId === eigen.id) {
    return { error: "Der eigene Zugang lässt sich nicht löschen." };
  }

  const fehler = await db.transaction(async (tx) => {
    await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, eigen.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, eigen, "owner");
    await assertFreshAuthentication(tx, eigen);
    if ((await countOwners(eigen.scope, parsed.data.userId, tx)) === 0) {
      return "Der letzte verantwortliche Zugang kann nicht gelöscht werden.";
    }
    const removed = await tx
      .delete(users)
      .where(
        and(
          eq(users.tenantId, eigen.scope.tenantId),
          eq(users.id, parsed.data.userId),
        ),
      )
      .returning({ id: users.id });
    return removed.length === 0 ? "Benutzer nicht gefunden." : null;
  });
  if (fehler) return { error: fehler };

  // Die Sitzungen raeumt der Fremdschluessel per ON DELETE CASCADE weg.
  revalidatePath("/admin/team");
  return { success: true };
}

/**
 * Das eigene Passwort aendern. Als einzige Aktion hier ohne requireOwner:
 * das darf jeder fuer sich selbst.
 */
export async function changeOwnPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const eigen = await requireAdmin();
  const parsed = z
    .object({ current: z.string().min(1, "Bitte das aktuelle Passwort eingeben."), password: passwort })
    .safeParse({
      current: text(formData, "current"),
      password: text(formData, "password"),
    });
  if (!parsed.success) return zodErrorState(parsed.error);

  const hash = await credentialHash(eigen.id);
  if (!hash || !(await verifyPassword(parsed.data.current, hash))) {
    const error = "Das aktuelle Passwort stimmt nicht.";
    return { error, fieldErrors: { current: error } };
  }
  const newHash = await hashPassword(parsed.data.password);
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, eigen.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, eigen, "self");
    const latest = await credentialHash(eigen.id, tx);
    if (latest !== hash) throw new Error("Das Passwort wurde inzwischen geändert. Bitte erneut anmelden.");
    await setCredentialHash(tx, eigen.id, newHash);
    await tx.delete(sessions).where(and(eq(sessions.userId, eigen.id), ne(sessions.id, eigen.sessionId)));
  });

  // Die eigene Sitzung bleibt bestehen, sonst fliegt man beim Passwortwechsel
  // aus der Verwaltung.
  return { success: true };
}
