import { headers } from "next/headers";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

// DB-backed statt In-Memory: läuft korrekt über mehrere serverless Instanzen (z. B. Vercel).
// Ein Upsert statt select+insert/update: race-frei und ein Round-Trip statt drei.
export async function rateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60 * 1000,
): Promise<boolean> {
  const now = new Date();
  const newResetAt = new Date(now.getTime() + windowMs);
  const expired = sql`${loginAttempts.resetAt} < ${now.toISOString()}::timestamptz`;

  const [row] = await db
    .insert(loginAttempts)
    .values({ key, count: 1, resetAt: newResetAt })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${loginAttempts.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${newResetAt.toISOString()}::timestamptz else ${loginAttempts.resetAt} end`,
      },
    })
    .returning({ count: loginAttempts.count });

  // Verwaiste Keys (nie wieder versuchte Logins) sammeln sich sonst unbegrenzt an –
  // günstiger Sweep statt bei jedem Aufruf, blockiert die Antwort nicht.
  if (Math.random() < 0.01) {
    db.delete(loginAttempts)
      .where(lt(loginAttempts.resetAt, now))
      .catch((err) => console.error("Rate-Limit-Sweep fehlgeschlagen", err));
  }

  return row.count <= max;
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

/**
 * Die Absenderadresse, an der das Rate-Limit haengt.
 *
 * Steht hier statt dreimal in den Actions, weil sie nur mit dem Limit
 * zusammen Sinn ergibt.
 *
 * Wichtig zu wissen: x-forwarded-for setzt der Reverse Proxy, der Header ist
 * aber grundsaetzlich clientseitig faelschbar. Die App muss deshalb hinter
 * einem Proxy stehen, der ihn ueberschreibt statt ihn anzuhaengen, sonst
 * umgeht ein Angreifer jedes Limit mit einem beliebigen Wert. Ohne Proxy
 * fallen alle Anfragen in denselben Topf „lokal“.
 */
export async function clientIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
}
