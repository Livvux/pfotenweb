import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { TenantScope } from "@/lib/tenant";
import type { TeamUser, UserRole } from "@/lib/roles";

export type { TeamUser, UserRole };

/*
 * Compilezeit-Pruefung in beide Richtungen: laeuft das Drizzle-Enum aus
 * schema.ts und die Union aus roles.ts auseinander, bricht der Build hier und
 * nicht erst zur Laufzeit an einer Rollenpruefung.
 */
type Enum = (typeof users.role.enumValues)[number];
type _EnumDecktUnion = Enum extends UserRole ? true : never;
type _UnionDecktEnum = UserRole extends Enum ? true : never;

const spalten = {
  id: users.id,
  username: users.username,
  role: users.role,
  createdAt: users.createdAt,
};

/**
 * Alle Konten dieses Vereins.
 *
 * Liegt in src/lib, weil Seiten laut ESLint-Regel nicht auf @/db zugreifen
 * duerfen. Der TenantScope steht als erster Parameter, so wie ueberall.
 */
export async function listUsers(t: TenantScope): Promise<TeamUser[]> {
  return db
    .select(spalten)
    .from(users)
    .where(eq(users.tenantId, t.tenantId))
    .orderBy(users.username);
}

/** Der Transaktions-Handle, so wie drizzle ihn an den Rueckruf gibt. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Wie viele Verantwortliche der Verein hat, optional ohne einen bestimmten.
 *
 * Die Regel „der letzte Verantwortliche bleibt“ hatte drei Rechenwege: eine
 * Zaehlabfrage in der Transaktion und zweimal ein filter() ueber die volle
 * Liste. Eine Invariante, eine Definition.
 *
 * Der optionale Transaktions-Handle ist kein Beiwerk: Zaehlung und UPDATE
 * muessen in derselben Transaktion laufen, sonst stufen zwei gleichzeitige
 * Klicks beide verbliebenen Verantwortlichen herab.
 */
/** Die Verantwortlichen des Vereins, fuer „wenden Sie sich an“. */
export async function listOwners(t: TenantScope): Promise<TeamUser[]> {
  return db
    .select(spalten)
    .from(users)
    .where(and(eq(users.tenantId, t.tenantId), eq(users.role, "owner")))
    .orderBy(users.username);
}

export async function countOwners(
  t: TenantScope,
  ausser?: number,
  tx: Tx | typeof db = db,
): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(users)
    .where(
      and(
        eq(users.tenantId, t.tenantId),
        eq(users.role, "owner"),
        ausser === undefined ? undefined : ne(users.id, ausser),
      ),
    );
  return row.value;
}
