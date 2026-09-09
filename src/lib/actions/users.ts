"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { requireAdmin, requireOwner } from "@/lib/auth";
import {
  idSchema,
  isUniqueViolation,
  text,
  zodErrorState,
  type FormState,
} from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";
import { countOwners } from "@/lib/users";


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
  const { scope } = await requireOwner();
  const parsed = z
    .object({ username: benutzername, password: passwort, role: rolle })
    .safeParse({
      username: text(formData, "username"),
      password: text(formData, "password"),
      role: text(formData, "role"),
    });
  if (!parsed.success) return zodErrorState(parsed.error);

  try {
    await db.insert(users).values({
      tenantId: scope.tenantId,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
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

export async function resetUserPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { scope } = await requireOwner();
  const parsed = z
    .object({ userId: idSchema, password: passwort })
    .safeParse({
      userId: formData.get("userId"),
      password: text(formData, "password"),
    });
  if (!parsed.success) return zodErrorState(parsed.error);

  const changed = await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(
      and(eq(users.tenantId, scope.tenantId), eq(users.id, parsed.data.userId)),
    )
    .returning({ id: users.id });
  if (changed.length === 0) return { error: "Benutzer nicht gefunden." };

  // Alle Sitzungen beenden. Ohne das bleibt jemand, dessen Passwort gerade
  // zurueckgesetzt wurde, noch bis zu 30 Tage angemeldet.
  await db.delete(sessions).where(eq(sessions.userId, parsed.data.userId));

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

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(
      and(eq(users.tenantId, eigen.scope.tenantId), eq(users.id, eigen.id)),
    );
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    const meldung = "Das aktuelle Passwort stimmt nicht.";
    return { error: meldung, fieldErrors: { current: meldung } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(
      and(eq(users.tenantId, eigen.scope.tenantId), eq(users.id, eigen.id)),
    );

  // Die eigene Sitzung bleibt bestehen, sonst fliegt man beim Passwortwechsel
  // aus der Verwaltung.
  return { success: true };
}
