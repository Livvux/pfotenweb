import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getPublishedPosts } from "@/lib/posts";
import { requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Aktuelles",
    description: `Neuigkeiten von ${settings.orgName}: Erfolge, Veranstaltungen und Geschichten aus dem Alltag.`,
  };
}

export default async function AktuellesPage() {
  const { scope } = await requireTenantWithSettings();
  const posts = await getPublishedPosts(scope);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 md:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-brand-900">
        Aktuelles
      </h1>
      <p className="mt-3 max-w-[65ch] leading-relaxed text-ink/70">
        Geschichten, Erfolge und Neuigkeiten rund um unsere Tiere.
      </p>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-3xl bg-white p-10 text-center ring-1 ring-brand-100">
          <p className="text-ink/60">
            Noch keine Beiträge – hier erscheinen bald Neuigkeiten.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/aktuelles/${post.slug}`}
              className="block rounded-3xl bg-white p-7 ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-950/10"
            >
              <time
                dateTime={post.createdAt.toISOString()}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700"
              >
                {formatDate(post.createdAt)}
              </time>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-brand-900">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-2 leading-relaxed text-ink/70">
                {post.body}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
