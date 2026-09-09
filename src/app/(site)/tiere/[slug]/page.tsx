import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SPECIES_LABELS,
  STATUS_LABELS,
  ageText,
  getAnimalBySlug,
} from "@/lib/animals";
import { AnimalGallery } from "@/components/animal-gallery";
import { requireActiveScope } from "@/lib/tenant";

export async function generateMetadata(
  { params }: PageProps<"/tiere/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const animal = await getAnimalBySlug(await requireActiveScope(), slug);
  if (!animal) return { title: "Tier nicht gefunden" };
  return {
    title: `${animal.name} – ${SPECIES_LABELS[animal.species]} vermitteln`,
    description: animal.description.slice(0, 155),
  };
}

export default async function AnimalDetailPage({
  params,
}: PageProps<"/tiere/[slug]">) {
  const { slug } = await params;
  const animal = await getAnimalBySlug(await requireActiveScope(), slug);
  if (!animal) notFound();

  const facts: [string, string][] = [
    ["Art", SPECIES_LABELS[animal.species]],
    ["Geboren", animal.birthYear ? String(animal.birthYear) : "unbekannt"],
    ...(ageText(animal) ? [["Alter", ageText(animal)] as [string, string]] : []),
    ...(animal.breed ? ([["Rasse", animal.breed]] as [string, string][]) : []),
    [
      "Geschlecht",
      animal.sex === "m" ? "männlich" : animal.sex === "w" ? "weiblich" : "unbekannt",
    ],
    ...(animal.size ? ([["Größe", animal.size]] as [string, string][]) : []),
  ];

  const available = animal.status === "vermittelbar";

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <Link
        href="/tiere"
        className="text-sm font-medium text-brand-700 transition hover:text-brand-900"
      >
        ← Alle Tiere
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <AnimalGallery images={animal.images} name={animal.name} />

        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-brand-900">
              {animal.name}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                available
                  ? "bg-brand-100 text-brand-800"
                  : animal.status === "reserviert"
                    ? "bg-accent-200 text-accent-700"
                    : "bg-stone-200 text-stone-600"
              }`}
            >
              {STATUS_LABELS[animal.status]}
            </span>
          </div>

          <dl className="mt-6 divide-y divide-brand-100 rounded-2xl bg-white px-5 ring-1 ring-brand-100">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
              >
                <dt className="text-ink/50">{label}</dt>
                <dd className="text-right font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 leading-relaxed whitespace-pre-line text-ink/80">
            {animal.description}
          </p>

          {available ? (
            <Link
              href={`/kontakt?tier=${animal.slug}`}
              className="mt-8 inline-block rounded-full bg-brand-800 px-7 py-3.5 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
            >
              {animal.name} kennenlernen
            </Link>
          ) : (
            <p className="mt-8 rounded-2xl bg-bone px-5 py-4 text-sm text-ink/70">
              Für {animal.name} ist dieser Weg schon gegangen oder gerade in
              Planung – schauen Sie sich gerne die anderen Tiere an.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
