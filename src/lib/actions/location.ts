"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tenants, tenantSettings } from "@/db/schema";
import { requireOwner } from "../auth";
import { assertCurrentAccess } from "../access";
import { locationSchema } from "../location-rules";
import { zodErrorState, type FormState } from "../form";
export async function saveLocation(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireOwner();
  const number = (name: string) => String(data.get(name) ?? "").trim() === "" ? null : Number(data.get(name));
  const parsed = locationSchema.safeParse({ enabled: data.get("enabled") === "on", address: data.get("address"), lat: number("lat"), lng: number("lng") });
  if (!parsed.success) return zodErrorState(parsed.error);
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, actor.scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "owner");
    await tx.update(tenantSettings).set({ location: parsed.data, updatedAt: new Date() }).where(eq(tenantSettings.tenantId, actor.scope.tenantId));
  });
  revalidatePath("/", "layout");
  return { success: true };
}
