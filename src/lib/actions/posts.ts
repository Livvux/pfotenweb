"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import type { TenantScope } from "@/lib/tenant";
import { zodErrorState, type FormState } from "@/lib/form";

export type PostFormState = FormState;

const postSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz.").max(180),
  body: z
    .string()
    .trim()
    .min(20, "Der Beitrag sollte mindestens 20 Zeichen enthalten.")
    .max(20000),
  published: z.boolean().default(false),
});

async function uniquePostSlug(
  t: TenantScope,
  title: string,
  excludeId?: number,
) {
  const base = slugify(title) || "beitrag";
  let candidate = base;
  for (let i = 2; ; i++) {
    const [existing] = await db
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
  const { scope } = await requireAdmin();
  const parsed = parsePost(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }
  const slug = await uniquePostSlug(scope, parsed.data.title);
  await db.insert(posts).values({ ...parsed.data, slug, tenantId: scope.tenantId });
  revalidatePath("/aktuelles");
  revalidatePath("/");
  redirect("/admin/aktuelles");
}

export async function updatePost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const { scope } = await requireAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const parsed = parsePost(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }
  const slug = await uniquePostSlug(scope, parsed.data.title, id);
  const changed = await db
    .update(posts)
    .set({ ...parsed.data, slug, updatedAt: new Date() })
    .where(and(eq(posts.tenantId, scope.tenantId), eq(posts.id, id)))
    .returning({ id: posts.id });
  if (changed.length === 0) return { error: "Beitrag nicht gefunden." };
  revalidatePath("/aktuelles");
  revalidatePath(`/aktuelles/${slug}`);
  revalidatePath("/");
  redirect("/admin/aktuelles");
}

export async function deletePost(formData: FormData): Promise<void> {
  const { scope } = await requireAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await db
    .delete(posts)
    .where(and(eq(posts.tenantId, scope.tenantId), eq(posts.id, id)));
  revalidatePath("/aktuelles");
  revalidatePath("/");
  redirect("/admin/aktuelles");
}
