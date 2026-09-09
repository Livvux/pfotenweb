import { db } from "../src/db";
import { tenants, tenantSettings, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import { sql } from "drizzle-orm";
import { z } from "zod";
async function main() {
 await db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(74, 1)`);
  if ((await tx.select().from(tenants)).length) { console.log("Bereits eingerichtet; keine Daten verändert."); return; }
  const config = z.object({ INITIAL_ADMIN_USERNAME: z.string().min(3).max(50), INITIAL_ADMIN_PASSWORD: z.string().min(16).max(200), INITIAL_ORG_NAME: z.string().min(2).max(60) }).parse(process.env);
  await tx.insert(tenants).values({ id: 1 });
  await tx.insert(tenantSettings).values({ tenantId: 1, orgName: config.INITIAL_ORG_NAME, shortName: config.INITIAL_ORG_NAME, heroHeadline: config.INITIAL_ORG_NAME });
  await tx.insert(users).values({ tenantId: 1, username: config.INITIAL_ADMIN_USERNAME, passwordHash: await hashPassword(config.INITIAL_ADMIN_PASSWORD), role: "owner" });
 });
 console.log("Ersteinrichtung abgeschlossen. Vereinsdaten unter /admin ergänzen.");
}
main().then(() => process.exit(0)).catch(() => { console.error("Einrichtung fehlgeschlagen. Datenbank und INITIAL_* Angaben prüfen (Passwort mindestens 16 Zeichen)."); process.exit(1); });
