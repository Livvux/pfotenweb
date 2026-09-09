"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const idSchema = z.coerce.number().int().positive();

export async function toggleInquiryResolved(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const [inquiry] = await db
    .select({ resolvedAt: inquiries.resolvedAt })
    .from(inquiries)
    .where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  if (!inquiry) return;

  await db
    .update(inquiries)
    .set({ resolvedAt: inquiry.resolvedAt ? null : new Date() })
    .where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  revalidatePath("/admin/anfragen");
}

export async function deleteInquiry(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  await db
    .delete(inquiries)
    .where(and(eq(inquiries.tenantId, scope.tenantId), eq(inquiries.id, id)));
  revalidatePath("/admin/anfragen");
}
