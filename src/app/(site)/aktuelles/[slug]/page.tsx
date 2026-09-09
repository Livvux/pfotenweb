import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getPostBySlug } from "@/lib/posts";
import { requireActiveScope } from "@/lib/tenant";

export async function generateMetadata(
  { params }: PageProps<"/aktuelles/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(await requireActiveScope(), slug);
  if (!post) return { title: "Beitrag nicht gefunden" };
  return { title: post.title, description: post.body.slice(0, 155) };
}

export default async function PostPage({
  params,
}: PageProps<"/aktuelles/[slug]">) {
  const { slug } = await params;
  const post = await getPostBySlug(await requireActiveScope(), slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 md:py-20">
      <Link
        href="/aktuelles"
        className="text-sm font-medium text-brand-700 transition hover:text-brand-900"
      >
        ← Alle Beiträge
      </Link>
      <article className="mt-6">
        <time
          dateTime={post.createdAt.toISOString()}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700"
        >
          {formatDate(post.createdAt)}
        </time>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-brand-900 md:text-4xl">
          {post.title}
        </h1>
        <div className="mt-6 space-y-4 leading-relaxed whitespace-pre-line text-ink/80">
          {post.body}
        </div>
      </article>
    </main>
  );
}
