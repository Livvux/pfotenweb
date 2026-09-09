import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getAnimals } from "@/lib/animals";
import { formatDate, getPublishedPosts } from "@/lib/posts";
import { AnimalCard } from "@/components/animal-card";
import { requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    // absolute, damit das Template des Root-Layouts den Namen nicht doppelt
    title: { absolute: `${settings.orgName} – Ein Zuhause schenken` },
    description: settings.heroSubline ?? settings.tagline ?? undefined,
  };
}

export default async function HomePage() {
  const { settings, scope } = await requireTenantWithSettings();
  const [animals, posts] = await Promise.all([
    getAnimals(scope, { status: "vermittelbar" }),
    getPublishedPosts(scope, 2),
  ]);
  const featured = animals.slice(0, 3);

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 md:pt-20 lg:grid-cols-[5fr_4fr] lg:pb-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">
            {settings.shortName}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-brand-900 md:text-6xl">
            {settings.heroHeadline ?? "Jedes Tier verdient eine zweite Geschichte."}
          </h1>
          {settings.heroSubline && (
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink/70">
              {settings.heroSubline}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/tiere"
              className="rounded-full bg-brand-800 px-7 py-3.5 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Tiere kennenlernen
            </Link>
            <Link
              href="/verein"
              className="rounded-full px-7 py-3.5 font-semibold text-brand-900 ring-1 ring-brand-200 transition hover:bg-brand-50 active:scale-[0.98]"
            >
              Über uns
            </Link>
          </div>
        </div>
        {settings.heroImageUrl && (
          <div className="relative">
            <Image
              src={settings.heroImageUrl}
            unoptimized={settings.heroImageUrl.startsWith("/uploads/t")}
              alt=""
              width={960}
              height={1200}
              priority
              className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl shadow-brand-950/15"
            />
          </div>
        )}
      </section>

      {/* Vermittelbare Tiere */}
      <section className="border-y border-brand-100 bg-bone/60">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-900">
              Sie suchen ein Zuhause
            </h2>
            <Link
              href="/tiere"
              className="shrink-0 text-sm font-semibold text-brand-700 transition hover:text-brand-900"
            >
              Alle Tiere →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </div>
        </div>
      </section>

      {/* Aktuelles */}
      {posts.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-900">
              Neues aus dem Heim
            </h2>
            <Link
              href="/aktuelles"
              className="shrink-0 text-sm font-semibold text-brand-700 transition hover:text-brand-900"
            >
              Alle Beiträge →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
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
                <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-brand-900">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 leading-relaxed text-ink/70">
                  {post.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Spenden-Band */}
      <section className="bg-brand-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:py-20">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Ihr Einsatz wird dringend gebraucht.
            </h2>
            <p className="mt-2 max-w-xl leading-relaxed text-brand-100">
              Als Verein leben wir allein von Spenden. Jeder Beitrag zahlt
              Futter, Tierarzt und Unterkünfte.
            </p>
          </div>
          <Link
            href="/kontakt"
            className="shrink-0 rounded-full bg-accent-400 px-7 py-3.5 font-semibold text-brand-950 transition hover:bg-accent-300 active:scale-[0.98]"
          >
            Helfen &amp; Mitglied werden
          </Link>
        </div>
      </section>
    </main>
  );
}
