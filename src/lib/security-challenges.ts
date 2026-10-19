import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { securityChallenges, tenants, users, type SecurityChallengePayload } from "@/db/schema";
import { assertCurrentAccess, assertFreshAuthentication } from "./access";
import { scopeOf } from "./tenant";
import { sendMessage } from "./email";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Kind = typeof securityChallenges.$inferSelect.kind;
function digest(value: string) {
  const key = process.env.SECURITY_MAIL_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("SECURITY_MAIL_KEY fehlt oder ist ungültig.");
  return createHmac("sha256", Buffer.from(key, "hex")).update(value).digest("hex");
}
export function challengeRateKey(value: string) { return digest(value.trim().toLowerCase()); }
export async function issueChallenge(input: { kind: Kind; email: string; userId?: number; payload?: SecurityChallengePayload; actor?: { id: number; sessionId: number } }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("Mailversand ist nicht eingerichtet.");
  const id = randomUUID();
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, 1)).for("update");
    if (["invite", "email", "reauth"].includes(input.kind)) {
      if (!input.actor || (input.kind !== "invite" && input.userId !== input.actor.id)) throw new Error("Zugang fehlt.");
      await assertCurrentAccess(tx, { ...input.actor, scope: scopeOf(1) }, input.kind === "invite" ? "owner" : "self");
      if (input.kind !== "reauth") await assertFreshAuthentication(tx, input.actor);
    }
    await tx.update(securityChallenges).set({ consumedAt: new Date() }).where(and(eq(securityChallenges.kind, input.kind), input.userId ? eq(securityChallenges.userId, input.userId) : eq(securityChallenges.email, input.email), isNull(securityChallenges.consumedAt)));
    const { actor: _actor, ...values } = input; void _actor;
    await tx.insert(securityChallenges).values({ id, ...values, tokenHash: digest(`${id}:${code}`), expiresAt: new Date(Date.now() + (input.kind === "invite" ? 24 * 60 : 10) * 60_000) });
  });
  const link = input.kind === "invite" ? `\n\n${new URL("/admin/einladung", process.env.SITE_URL).href}#token=${id}` : "";
  try {
    await sendMessage({ to: input.email, subject: input.kind === "invite" ? "Einladung zum Pfotenweb-Vereinszugang" : "Pfotenweb: persönlicher Bestätigungscode", orgName: "Pfotenweb", text: `Der persönliche Bestätigungscode lautet:\n\n${code}\n\nDer Code ist ${input.kind === "invite" ? "24 Stunden" : "10 Minuten"} gültig und nur einmal verwendbar.${link}\n\nFalls diese Nachricht nicht angefordert wurde, kann sie ignoriert werden.` });
  } catch (error) {
    await db.update(securityChallenges).set({ consumedAt: new Date() }).where(eq(securityChallenges.id, id));
    throw error;
  }
  return id;
}
export async function consumeChallenge(tx: Tx, id: string, code: string, kind: Kind, userId?: number) {
  if (!/^\d{6}$/.test(code)) return null;
  const [challenge] = await tx.select().from(securityChallenges).where(and(eq(securityChallenges.id, id), eq(securityChallenges.kind, kind))).for("update");
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || (userId !== undefined && challenge.userId !== userId)) return null;
  const expected = Buffer.from(challenge.tokenHash, "hex");
  const actual = Buffer.from(digest(`${id}:${code}`), "hex");
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  await tx.update(securityChallenges).set({ attempts: sql`${securityChallenges.attempts} + 1`, ...(valid ? { consumedAt: new Date() } : {}) }).where(eq(securityChallenges.id, id));
  return valid ? challenge : null;
}
export async function verifiedRecoveryUser(email: string) {
  const [user] = await db.select().from(users).where(and(eq(users.recoveryEmail, email.trim().toLowerCase()), eq(users.active, true)));
  return user?.recoveryEmailVerifiedAt && user.email === user.recoveryEmail && user.emailVerified ? user : null;
}
