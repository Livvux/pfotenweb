import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Über den Verein",
    description: settings.aboutIntro?.slice(0, 155) ?? settings.tagline ?? undefined,
  };
}

export default async function VereinPage() {
  const { settings } = await requireTenantWithSettings();
  const facts = settings.facts ?? [];

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">
          Über uns
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-brand-900 md:text-5xl">
          Menschen, die bleiben, bis ein Tier angekommen ist.
        </h1>
        {settings.aboutIntro && (
          <p className="mt-6 max-w-[65ch] text-lg leading-relaxed whitespace-pre-line text-ink/70">
            {settings.aboutIntro}
          </p>
        )}
      </section>

      {facts.length > 0 && (
        <section className="border-y border-brand-100 bg-white">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-4 py-12 md:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="pr-6">
                <dd className="font-display text-4xl font-semibold text-brand-800">
                  {fact.value}
                </dd>
                <dt className="mt-1 text-sm text-ink/60">{fact.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:py-20">
        {settings.aboutWork && (
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-900">
              Wie wir arbeiten
            </h2>
            <p className="mt-4 max-w-[60ch] leading-relaxed whitespace-pre-line text-ink/70">
              {settings.aboutWork}
            </p>
          </div>
        )}
        {settings.aboutSupport && (
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-900">
              Was uns trägt
            </h2>
            <p className="mt-4 max-w-[60ch] leading-relaxed whitespace-pre-line text-ink/70">
              {settings.aboutSupport}
            </p>
          </div>
        )}
      </section>

      <section className="bg-brand-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Mitglied werden. Pate werden. Helfen.
            </h2>
            <p className="mt-2 max-w-xl text-brand-100">
              Schreiben Sie uns – wir finden heraus, wie Ihr Engagement am
              besten wirkt.
            </p>
          </div>
          <Link
            href="/kontakt"
            className="shrink-0 rounded-full bg-accent-400 px-7 py-3.5 font-semibold text-brand-950 transition hover:bg-accent-300 active:scale-[0.98]"
          >
            Kontakt aufnehmen
          </Link>
        </div>
      </section>
    </main>
  );
}
