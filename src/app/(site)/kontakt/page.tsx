import type { Metadata } from "next";
import { getAnimalBySlug } from "@/lib/animals";
import { ContactForm } from "@/components/contact-form";
import { addressLines, requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Kontakt & Anfahrt",
    description: `Nehmen Sie Kontakt zu ${settings.orgName} auf, ob Vermittlungsanfrage, Patenschaft oder Frage.`,
  };
}

export default async function KontaktPage({
  searchParams,
}: PageProps<"/kontakt">) {
  const { settings, scope } = await requireTenantWithSettings();
  const params = await searchParams;
  const tier = typeof params.tier === "string" ? params.tier : undefined;
  let subject: string | undefined;
  let animalId: number | undefined;

  if (tier) {
    const animal = await getAnimalBySlug(scope, tier);
    if (animal && animal.status === "vermittelbar") {
      subject = `Anfrage zu ${animal.name}`;
      animalId = animal.id;
    }
  }

  // Leere Felder fallen raus, damit ein Verein ohne Telefon keine leere Zeile bekommt.
  const details = (
    [
      ["Besuchszeiten", settings.openingHours],
      ["Telefon", settings.phone],
      ["Adresse", addressLines(settings).join(" · ") || null],
    ] as [string, string | null][]
  ).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <div className="grid gap-12 lg:grid-cols-[2fr_3fr]">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-brand-900">
            Wir freuen uns auf Sie
          </h1>
          <p className="mt-4 max-w-[55ch] leading-relaxed text-ink/70">
            Ob Vermittlungsanfrage, Patenschaft oder Frage zum Verein –
            schreiben Sie uns. Für einen Besuch vereinbaren Sie bitte vorher
            telefonisch einen Termin.
          </p>
          <dl className="mt-8 space-y-4 text-sm">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-brand-900">{label}</dt>
                <dd className="mt-1 whitespace-pre-line text-ink/70">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl bg-white p-7 ring-1 ring-brand-100 md:p-9">
          <ContactForm subject={subject} animalId={animalId} />
        </div>
      </div>
    </main>
  );
}
