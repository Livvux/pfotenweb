import type { TenantScope } from "./tenant";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, authPasskeys } from "@/db/schema";
import { credentialHash } from "./auth-users";
export async function ownAccount(id: number) {
  const [user] = await db.select({ username: users.username, updatedAt: users.updatedAt, displayName: users.displayName, profileRole: users.profileRole, bio: users.bio, profileImage: users.profileImage, recoveryEmail: users.recoveryEmail, recoveryEmailVerifiedAt: users.recoveryEmailVerifiedAt }).from(users).where(eq(users.id, id));
  if (!user) throw new Error("Zugang fehlt.");
  const keys = await db.select({ id: authPasskeys.id, name: authPasskeys.name }).from(authPasskeys).where(eq(authPasskeys.userId, id));
  return { user, keys, hasPassword: Boolean(await credentialHash(id)) };
}

export async function isProfileImage(url: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.profileImage, url)).limit(1);
  return Boolean(user);
}

export async function listTeamProfiles(scope: TenantScope) {
  return db.select({ id: users.id, username: users.username, displayName: users.displayName, profileRole: users.profileRole, bio: users.bio, profileImage: users.profileImage }).from(users).where(and(eq(users.tenantId, scope.tenantId), eq(users.active, true))).orderBy(users.username);
}
