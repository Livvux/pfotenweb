import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, tenants, users } from "@/db/schema";
import { assertCurrentAccess } from "./access";
import type { AdminUser } from "./auth";
import { canAccess } from "./roles";
export async function adminNotifications(user: AdminUser) {
  if (!canAccess(user, "inquiries")) return { unread: 0 };
  const [account] = await db.select({ seen: users.inquiriesSeenAt, active: users.active, role: users.role, permissions: users.permissions }).from(users).where(and(eq(users.id, user.id), eq(users.tenantId, user.scope.tenantId)));
  if (!account?.active || !canAccess(account, "inquiries")) return { unread: 0 };
  const [row] = await db.select({ unread: sql<number>`count(*)::int` }).from(inquiries).where(and(eq(inquiries.tenantId, user.scope.tenantId), isNull(inquiries.resolvedAt), account.seen ? gt(inquiries.createdAt, account.seen) : undefined));
  return row;
}
export async function markInquiriesSeen(user: AdminUser) {
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, user.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, user, "inquiries");
    await tx.update(users).set({ inquiriesSeenAt: new Date() }).where(eq(users.id, user.id));
  });
}
export async function tourCompleted(user: AdminUser) {
  const [row] = await db.select({ completed: users.tourCompletedAt }).from(users).where(and(eq(users.id, user.id), eq(users.tenantId, user.scope.tenantId)));
  return Boolean(row?.completed);
}
export async function completeTour(user: AdminUser) {
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, user.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, user, "self");
    await tx.update(users).set({ tourCompletedAt: new Date() }).where(eq(users.id, user.id));
  });
}
