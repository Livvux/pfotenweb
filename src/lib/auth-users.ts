import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts, users } from "@/db/schema";
import { hashPassword } from "./password";
import type { UserRole } from "./roles";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function createCredentialUser(tx: Tx, input: { tenantId: number; username: string; password?: string; passwordHash?: string; role: UserRole; permissions?: string[]; email?: string; verifiedEmail?: boolean }) {
  const [user] = await tx.insert(users).values({ tenantId: input.tenantId, username: input.username, displayUsername: input.username, name: input.username, email: input.email ?? `account-${randomUUID()}@pfotenweb.invalid`, emailVerified: input.verifiedEmail ?? false, recoveryEmail: input.verifiedEmail ? input.email : null, recoveryEmailVerifiedAt: input.verifiedEmail ? new Date() : null, role: input.role, permissions: input.permissions ?? [] }).returning();
  if (input.passwordHash || input.password) await setCredentialHash(tx, user.id, input.passwordHash ?? await hashPassword(input.password!));
  return user;
}
export async function credentialHash(userId: number, tx: Tx | typeof db = db) {
  const [account] = await tx.select({ password: authAccounts.password }).from(authAccounts).where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")));
  return account?.password ?? null;
}
export async function setCredentialHash(tx: Tx, userId: number, password: string) {
  await tx.insert(authAccounts).values({ userId, accountId: String(userId), providerId: "credential", password }).onConflictDoUpdate({ target: [authAccounts.userId, authAccounts.providerId], set: { password, updatedAt: new Date() } });
}
