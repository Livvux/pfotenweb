"use server";

import { assertCurrentAccess } from "@/lib/access";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inquiries, tenants } from "@/db/schema";
import { requireArea } from "@/lib/auth";

const idSchema = z.coerce.number().int().positive();

export async function toggleInquiryResolved(formData: FormData): Promise<void> {
  const actor = await requireArea("inquiries");
  const { scope } = actor;
  const id = idSchema.parse(formData.get("id"));
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "inquiries");
  const [inquiry] = await tx
    .select({ resolvedAt: inquiries.resolvedAt })
    .from(inquiries)
    .where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  if (!inquiry) return;

  await tx
    .update(inquiries)
    .set({ resolvedAt: inquiry.resolvedAt ? null : new Date() })
    .where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  });
  revalidatePath("/admin/anfragen");
}

export async function deleteInquiry(formData: FormData): Promise<void> {
  const actor = await requireArea("inquiries");
  const { scope } = actor;
  const id = idSchema.parse(formData.get("id"));
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "inquiries");
    await tx.delete(inquiries).where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  });
  revalidatePath("/admin/anfragen");
}
