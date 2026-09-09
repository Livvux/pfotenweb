import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, inquiries, posts } from "@/db/schema";
import type { TenantScope } from "@/lib/tenant";

export type Inquiry = typeof inquiries.$inferSelect;
export type InquiryRow = { inquiry: Inquiry; animalName: string | null };

/**
 * Anfragen des eigenen Vereins, mit dem Namen des angefragten Tiers.
 *
 * Der Join traegt den Vereinsfilter auf BEIDEN Seiten. Der zusammengesetzte
 * Fremdschluessel auf (tenant_id, animal_id) macht eine vereinsuebergreifende
 * Verknuepfung zwar schon in der Datenbank unmoeglich, aber die Bedingung
 * kostet nichts und haelt die Abfrage auch dann korrekt, wenn das Schema
 * einmal anders aussieht.
 */
export async function getInquiries(t: TenantScope): Promise<InquiryRow[]> {
  return db
    .select({ inquiry: inquiries, animalName: animals.name })
    .from(inquiries)
    .leftJoin(
      animals,
      and(
        eq(inquiries.animalId, animals.id),
        eq(animals.tenantId, t.tenantId),
      ),
    )
    .where(eq(inquiries.tenantId, t.tenantId))
    .orderBy(desc(inquiries.createdAt));
}

export type DashboardStats = {
  animalsTotal: number;
  animalsAvailable: number;
  postsTotal: number;
  openInquiries: number;
  latestInquiries: {
    id: number;
    name: string;
    subject: string | null;
    createdAt: Date;
  }[];
};

/** Kennzahlen des Adminstarts, alle vier Abfragen auf den eigenen Verein. */
export async function getDashboardStats(
  t: TenantScope,
): Promise<DashboardStats> {
  const [[animalStats], [openInquiries], [postCount], latestInquiries] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(*) filter (where ${animals.status} = 'vermittelbar')::int`,
        })
        .from(animals)
        .where(eq(animals.tenantId, t.tenantId)),
      db
        .select({ open: sql<number>`count(*)::int` })
        .from(inquiries)
        .where(
          and(
            eq(inquiries.tenantId, t.tenantId),
            isNull(inquiries.resolvedAt),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(eq(posts.tenantId, t.tenantId)),
      db
        .select({
          id: inquiries.id,
          name: inquiries.name,
          subject: inquiries.subject,
          createdAt: inquiries.createdAt,
        })
        .from(inquiries)
        .where(
          and(
            eq(inquiries.tenantId, t.tenantId),
            isNull(inquiries.resolvedAt),
          ),
        )
        .orderBy(desc(inquiries.createdAt))
        .limit(5),
    ]);

  return {
    animalsTotal: animalStats.total,
    animalsAvailable: animalStats.available,
    postsTotal: postCount.count,
    openInquiries: openInquiries.open,
    latestInquiries,
  };
}
