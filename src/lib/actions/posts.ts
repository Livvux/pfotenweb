"use server";

import { assertCurrentAccess } from "@/lib/access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { postSchema } from "../content-schemas";
import { db } from "@/db";
import { posts, tenants } from "@/db/schema";
import { requireArea } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import type { TenantScope } from "@/lib/tenant";
import { zodErrorState, type FormState } from "@/lib/form";

export type PostFormState = FormState;



async function uniquePostSlug(
  t: TenantScope,
  title: string,
  excludeId?: number,
  client: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
) {
  const base = slugify(title) || "beitrag";
  let candidate = base;
  for (let i = 2; ; i++) {
    const [existing] = await client
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.tenantId, t.tenantId), eq(posts.slug, candidate)));
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
  }
}

function parsePost(formData: FormData) {
  return postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    published: formData.get("published") === "on",
  });
}

export async function createPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const actor = await requireArea("posts");
  const { scope } = actor;
  const parsed = parsePost(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "posts");
    const slug = await uniquePostSlug(scope, parsed.data.title, undefined, tx);
    await tx.insert(posts).values({ ...parsed.data, slug, tenantId: scope.tenantId });
  });
  revalidatePath("/aktuelles");
  revalidatePath("/");
  redirect("/admin/aktuelles");
}

export async function updatePost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const actor = await requireArea("posts");
  const { scope } = actor;
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const parsed = parsePost(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }
  const result = await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "posts");
    const slug = await uniquePostSlug(scope, parsed.data.title, id, tx);
    const changed = await tx.update(posts).set({ ...parsed.data, slug, updatedAt: new Date() })
      .where(and(eq(posts.tenantId, scope.tenantId), eq(posts.id, id))).returning({ id: posts.id });
    return { slug, found: changed.length > 0 };
  });
  if (!result.found) return { error: "Beitrag nicht gefunden." };
  const { slug } = result;
  revalidatePath("/aktuelles");
  revalidatePath(`/aktuelles/${slug}`);
  revalidatePath("/");
  redirect("/admin/aktuelles");
}

export async function deletePost(formData: FormData): Promise<void> {
  const actor = await requireArea("posts");
  const { scope } = actor;
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await db.transaction(async tx => {
    await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId)).for("update");
    await assertCurrentAccess(tx, actor, "posts");
    await tx.delete(posts).where(and(eq(posts.tenantId, scope.tenantId), eq(posts.id, id)));
  });
  revalidatePath("/aktuelles");
  revalidatePath("/");
  redirect("/admin/aktuelles");
}
