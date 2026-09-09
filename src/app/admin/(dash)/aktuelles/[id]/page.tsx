import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostByIdForAdmin } from "@/lib/posts";
import { requireAdmin } from "@/lib/auth";
import { PostForm } from "@/components/admin/post-form";

export default async function BeitragBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // Beitrag eines fremden Vereins ist hier schlicht nicht auffindbar.
  const post = await getPostByIdForAdmin(scope, id);
  if (!post) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/aktuelles"
        className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
      >
        ← Aktuelles
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
        Beitrag bearbeiten
      </h1>
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <PostForm post={post} />
      </div>
    </div>
  );
}
