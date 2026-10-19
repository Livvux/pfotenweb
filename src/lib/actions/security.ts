"use server";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { authSessions, tenants, users } from "@/db/schema";
import { auth } from "../auth-config";
import { requireAdmin, requireOwner } from "../auth";
import { credentialHash, createCredentialUser, setCredentialHash } from "../auth-users";
import { assertCurrentAccess, assertFreshAuthentication } from "../access";
import { verifyPassword, hashPassword } from "../password";
import { clientIp, rateLimit } from "../rate-limit";
import { challengeRateKey, consumeChallenge, issueChallenge, verifiedRecoveryUser } from "../security-challenges";
import { areas } from "../roles";
import { zodErrorState, type FormState } from "../form";
export type SecurityState = FormState & { challengeId?: string; notice?: string };
const emailSchema = z.email().max(160).transform(value => value.trim().toLowerCase());
const codeSchema = z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/, "Bitte den sechsstelligen Code eingeben.") });
const notice = "Falls die Adresse für diesen Zugang bestätigt ist, wurde eine persönliche Nachricht verschickt.";
async function allowed(email: string, purpose: string) {
  return rateLimit(`security:${purpose}:${challengeRateKey(email)}:${await clientIp()}`, 5, 15 * 60_000);
}
export async function requestLoginCode(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = emailSchema.safeParse(data.get("email"));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await allowed(parsed.data, "login")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  const user = await verifiedRecoveryUser(parsed.data);
  let challengeId = randomUUID();
  if (user) {
    try { challengeId = await issueChallenge({ kind: "login", email: parsed.data, userId: user.id }); }
    catch { /* Same answer for unknown accounts and unavailable mail delivery. */ }
  }
  return { challengeId, notice };
}
export async function confirmLoginCode(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = codeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await rateLimit(`code:${parsed.data.challengeId}:${await clientIp()}`, 10)) return { error: "Bitte einen neuen Code anfordern." };
  const userId = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
    const challenge = await consumeChallenge(tx, parsed.data.challengeId, parsed.data.code, "login");
    if (!challenge?.userId) return null;
    const [user] = await tx.select().from(users).where(eq(users.id, challenge.userId));
    return user?.active && user.emailVerified && user.recoveryEmailVerifiedAt && user.email === challenge.email && user.recoveryEmail === challenge.email ? user.id : null;
  });
  if (!userId) return { error: "Code ungültig oder abgelaufen. Bitte erneut anfordern." };
  try { await auth.api.createVerifiedSession({ body: { userId }, headers: await headers() }); }
  catch { return { error: "Die Anmeldung konnte nicht abgeschlossen werden. Bitte einen neuen Code anfordern." }; }
  redirect("/admin");
}
export async function requestMagicLogin(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = emailSchema.safeParse(data.get("email"));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await allowed(parsed.data, "link")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  const user = await verifiedRecoveryUser(parsed.data);
  if (user) {
    try { await auth.api.signInMagicLink({ body: { email: user.email, callbackURL: "/admin" }, headers: await headers() }); }
    catch { /* Do not expose whether an address belongs to an account. */ }
  }
  return { notice };
}
export async function confirmMagicLogin(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const token = z.string().min(20).max(500).safeParse(data.get("token"));
  if (!token.success) return { error: "Link ungültig oder abgelaufen." };
  if (!await rateLimit(`magic:${await clientIp()}`, 20)) return { error: "Bitte kurz warten und erneut versuchen." };
  try { await auth.api.magicLinkVerify({ query: { token: token.data }, headers: await headers() }); }
  catch { return { error: "Link ungültig oder abgelaufen. Bitte einen neuen Link anfordern." }; }
  redirect("/admin");
}
export async function requestPasswordReset(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = emailSchema.safeParse(data.get("email"));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await allowed(parsed.data, "reset")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  const user = await verifiedRecoveryUser(parsed.data);
  if (user) {
    try { await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/admin/passwort-zuruecksetzen" }, headers: await headers() }); }
    catch { /* Same response regardless of account existence or SMTP status. */ }
  }
  return { notice };
}
export async function resetPassword(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = z.object({ token: z.string().min(20).max(500), password: z.string().min(8).max(200) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await rateLimit(`reset-confirm:${await clientIp()}`, 10)) return { error: "Bitte später erneut versuchen." };
  try { await auth.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password }, headers: await headers() }); }
  catch { return { error: "Link ungültig oder abgelaufen. Bitte einen neuen Link anfordern." }; }
  redirect("/admin/login");
}
export async function confirmPassword(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  if (!await rateLimit(`reauth-password:${actor.id}`, 5)) return { error: "Bitte in 15 Minuten erneut versuchen." };
  const password = z.string().min(1).max(200).safeParse(data.get("password"));
  const hash = await credentialHash(actor.id);
  if (!password.success || !hash || !await verifyPassword(password.data, hash)) return { error: "Passwort ungültig. Ohne Passwort bitte den E-Mail-Code verwenden." };
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
    await assertCurrentAccess(tx, actor, "self");
    if (await credentialHash(actor.id, tx) !== hash) throw new Error("Passwort wurde inzwischen geändert.");
    await tx.update(authSessions).set({ reauthenticatedAt: new Date() }).where(and(eq(authSessions.id, actor.sessionId), eq(authSessions.userId, actor.id)));
  });
  revalidatePath("/admin/konto");
  return { success: true };
}
export async function requestReauthenticationCode(_previous: SecurityState, _data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  const [user] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!user.recoveryEmail || !user.recoveryEmailVerifiedAt || !user.emailVerified || user.email !== user.recoveryEmail) return { error: "Zuerst eine persönliche E-Mail-Adresse bestätigen." };
  if (!await allowed(user.recoveryEmail, "reauth")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  try { return { challengeId: await issueChallenge({ kind: "reauth", email: user.recoveryEmail, userId: actor.id, actor }), notice: "Der persönliche Code wurde verschickt." }; }
  catch { return { error: "Code konnte nicht verschickt werden. Bitte die Mailkonfiguration prüfen." }; }
}
export async function confirmReauthenticationCode(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  const parsed = codeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  const valid = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
    await assertCurrentAccess(tx, actor, "self");
    const challenge = await consumeChallenge(tx, parsed.data.challengeId, parsed.data.code, "reauth", actor.id);
    const [user] = await tx.select().from(users).where(eq(users.id, actor.id));
    if (!challenge || user.recoveryEmail !== challenge.email || !user.recoveryEmailVerifiedAt) return false;
    await tx.update(authSessions).set({ reauthenticatedAt: new Date() }).where(and(eq(authSessions.id, actor.sessionId), eq(authSessions.userId, actor.id)));
    return true;
  });
  revalidatePath("/admin/konto");
  return valid ? { success: true } : { error: "Code ungültig oder abgelaufen." };
}
export async function requestEmailConfirmation(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  const parsed = emailSchema.safeParse(data.get("email"));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await allowed(parsed.data, "email")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  try { return { challengeId: await issueChallenge({ kind: "email", email: parsed.data, userId: actor.id, actor }), notice: "Der Bestätigungscode wurde an die neue Adresse verschickt." }; }
  catch { return { error: "Bitte Passwort oder E-Mail-Code frisch bestätigen und die Mailkonfiguration prüfen." }; }
}
export async function confirmEmail(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  const parsed = codeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  try {
    const valid = await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
      await assertCurrentAccess(tx, actor, "self");
      const challenge = await consumeChallenge(tx, parsed.data.challengeId, parsed.data.code, "email", actor.id);
      if (!challenge) return false;
      await tx.update(users).set({ email: challenge.email, emailVerified: true, recoveryEmail: challenge.email, recoveryEmailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, actor.id));
      await tx.delete(authSessions).where(and(eq(authSessions.userId, actor.id), ne(authSessions.id, actor.sessionId)));
      return true;
    });
    revalidatePath("/admin/konto");
    return valid ? { success: true } : { error: "Code ungültig oder abgelaufen." };
  } catch { return { error: "Diese Adresse kann nicht zugeordnet werden. Bitte eine andere persönliche Adresse bestätigen." }; }
}
export async function inviteUser(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireOwner();
  const parsed = z.object({ email: emailSchema, username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/), role: z.enum(["owner", "editor"]), permissions: z.array(z.enum(areas)) }).safeParse({ ...Object.fromEntries(data), permissions: data.getAll("permissions") });
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await allowed(parsed.data.email, "invite")) return { error: "Bitte in 15 Minuten erneut versuchen." };
  try {
    await issueChallenge({ kind: "invite", email: parsed.data.email, actor, payload: { username: parsed.data.username, role: parsed.data.role, permissions: parsed.data.permissions, invitedBy: actor.id } });
    return { success: true, notice: "Die Einladung wurde verschickt und ist 24 Stunden gültig." };
  } catch { return { error: "Bitte Passwort oder E-Mail-Code frisch bestätigen und die Mailkonfiguration prüfen." }; }
}
export async function acceptInvitation(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const parsed = codeSchema.extend({ password: z.string().max(200).refine(value => !value || value.length >= 8, "Mindestens 8 Zeichen oder leer lassen.") }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return zodErrorState(parsed.error);
  if (!await rateLimit(`invite:${parsed.data.challengeId}:${await clientIp()}`, 10)) return { error: "Bitte eine neue Einladung anfordern." };
  let userId: number | null;
  try {
    userId = await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
      const challenge = await consumeChallenge(tx, parsed.data.challengeId, parsed.data.code, "invite");
      if (!challenge?.payload.invitedBy || !challenge.payload.username || !challenge.payload.role) return null;
      const [owner] = await tx.select().from(users).where(eq(users.id, challenge.payload.invitedBy));
      if (!owner?.active || owner.role !== "owner") return null;
      const user = await createCredentialUser(tx, { tenantId: 1, username: challenge.payload.username, email: challenge.email, verifiedEmail: true, role: challenge.payload.role, permissions: challenge.payload.permissions ?? [], password: parsed.data.password || undefined });
      return user.id;
    });
  } catch { return { error: "Einladung konnte nicht übernommen werden. Der Benutzername oder die Adresse ist möglicherweise bereits vergeben." }; }
  if (!userId) return { error: "Einladung ungültig oder abgelaufen." };
  await auth.api.createVerifiedSession({ body: { userId }, headers: await headers() });
  redirect("/admin");
}

export async function setFirstPassword(_previous: SecurityState, data: FormData): Promise<SecurityState> {
  const actor = await requireAdmin();
  const parsed = z.string().min(8).max(200).safeParse(data.get("password"));
  if (!parsed.success) return zodErrorState(parsed.error);
  const hash = await hashPassword(parsed.data);
  try {
    await db.transaction(async tx => {
      await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
      await assertCurrentAccess(tx, actor, "self");
      await assertFreshAuthentication(tx, actor);
      if (await credentialHash(actor.id, tx)) throw new Error("Ein Passwort besteht bereits. Bitte die Passwortänderung verwenden.");
      await setCredentialHash(tx, actor.id, hash);
      await tx.delete(authSessions).where(and(eq(authSessions.userId, actor.id), ne(authSessions.id, actor.sessionId)));
    });
  } catch { return { error: "Bitte den Zugang frisch per E-Mail-Code bestätigen. Ein vorhandenes Passwort wird hier nicht ersetzt." }; }
  revalidatePath("/admin/konto");
  return { success: true };
}
