"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { donationSettings, tenants } from "@/db/schema";
import { requireOwner } from "../auth";
import { assertCurrentAccess } from "../access";
import { bankSchema, donationCopySchema } from "../donation-rules";
import { zodErrorState, type FormState } from "../form";
export async function saveDonations(_prev: FormState, data: FormData): Promise<FormState> {
  const actor = await requireOwner();
  const values = Object.fromEntries(data);
  const bank = bankSchema.safeParse(values);
  if (!bank.success) return zodErrorState(bank.error);
  const copy = donationCopySchema.safeParse(values);
  if (!copy.success) return zodErrorState(copy.error);
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, actor.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "owner");
    const fields = { ...bank.data, ...copy.data, updatedAt: new Date() };
    await tx.insert(donationSettings).values({ ...fields, tenantId: actor.scope.tenantId }).onConflictDoUpdate({ target: donationSettings.tenantId, set: fields });
  });
  revalidatePath("/", "layout");
  return { success: true };
}
