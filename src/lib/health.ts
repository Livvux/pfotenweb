import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Prueft, ob die Datenbank antwortet. Fuer den Healthcheck von Docker,
 * Coolify oder einem Uptime-Dienst.
 *
 * Die einzige Abfragefunktion im Projekt ohne TenantScope, und das mit
 * Absicht: sie liest keine Daten, sondern nur, ob die Verbindung steht.
 * `select 1` beruehrt keine Tabelle und kann darum auch keine
 * Vereinsgrenze verletzen. Waere hier ein Scope verlangt, muesste der
 * Healthcheck einen Host mitbringen, den er nicht hat.
 */
export async function datenbankErreichbar(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (fehler) {
    console.error("Healthcheck: Datenbank nicht erreichbar:", fehler);
    return false;
  }
}
