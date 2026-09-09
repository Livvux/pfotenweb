import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import type { TenantScope } from "@/lib/tenant";

export type Post = typeof posts.$inferSelect;

export async function getPublishedPosts(
  t: TenantScope,
  limit?: number,
): Promise<Post[]> {
  const query = db
    .select()
    .from(posts)
    .where(and(eq(posts.tenantId, t.tenantId), eq(posts.published, true)))
    .orderBy(desc(posts.createdAt));
  return limit ? query.limit(limit) : query;
}

export async function getPublishedPostSlugs(
  t: TenantScope,
): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(eq(posts.tenantId, t.tenantId), eq(posts.published, true)));
}

// cache(): generateMetadata und die Seite selbst fragen denselben Beitrag ab.
export const getPostBySlug = cache(async function getPostBySlug(
  t: TenantScope,
  slug: string,
): Promise<Post | null> {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.tenantId, t.tenantId), eq(posts.slug, slug)));
  if (!post || !post.published) return null;
  return post;
});

/** Adminliste: auch Entwuerfe, aber ausschliesslich die des eigenen Vereins. */
export async function getAllPosts(t: TenantScope): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(eq(posts.tenantId, t.tenantId))
    .orderBy(desc(posts.createdAt));
}

export async function getPostByIdForAdmin(
  t: TenantScope,
  id: number,
): Promise<Post | null> {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.tenantId, t.tenantId), eq(posts.id, id)));
  return post ?? null;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
