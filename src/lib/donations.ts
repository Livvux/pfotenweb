import { eq } from "drizzle-orm";
import { db } from "@/db";
import { donationSettings } from "@/db/schema";
import type { TenantScope } from "./tenant";
import { donationCopyDefaults, emptyBank } from "./donation-rules";
export async function getDonations(scope: TenantScope) {
  const [row] = await db.select().from(donationSettings).where(eq(donationSettings.tenantId, scope.tenantId));
  return row ?? { ...donationCopyDefaults, ...emptyBank };
}
