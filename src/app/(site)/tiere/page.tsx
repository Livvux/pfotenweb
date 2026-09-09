import type { Metadata } from "next";
import Link from "next/link";
import { AnimalCard } from "@/components/animal-card";
import {
  SPECIES_LABELS,
  STATUS_LABELS,
  getAnimals,
} from "@/lib/animals";
import type { Animal } from "@/lib/animals";
import { requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Tiere vermitteln",
    description: `Alle Tiere, die bei ${settings.orgName} ein neues Zuhause suchen.`,
  };
}

type Filter = {
  species?: Animal["species"];
  status?: Animal["status"];
};

function isValidSpecies(v: string | undefined): v is Animal["species"] {
  return !!v && Object.hasOwn(SPECIES_LABELS, v);
}

function isValidStatus(v: string | undefined): v is Animal["status"] {
  return !!v && Object.hasOwn(STATUS_LABELS, v);
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-800 text-white"
          : "bg-white text-ink/70 ring-1 ring-brand-100 hover:bg-brand-50 hover:text-brand-900"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function TierePage({
  searchParams,
}: PageProps<"/tiere">) {
  const params = await searchParams;
  const art = typeof params.art === "string" ? params.art : undefined;
  const status =
    typeof params.status === "string" ? params.status : undefined;

  const filters: Filter = {};
  if (isValidSpecies(art)) filters.species = art;
  if (isValidStatus(status)) filters.status = status;

  // Bewusst eine einzige Abfrage: der Bestand eines Vereins ist klein genug,
  // um im Speicher zu filtern. Zwei Abfragen bedeuteten hier vier Roundtrips,
  // weil jede zusaetzlich die Bilder nachlaedt.
  const { scope } = await requireTenantWithSettings();
  const all = await getAnimals(scope);
  const list = all.filter(
    (a) =>
      (!filters.species || a.species === filters.species) &&
      (!filters.status || a.status === filters.status),
  );

  const buildHref = (next: Filter) => {
    const merged = {
      species: filters.species,
      status: filters.status,
      ...next,
    };
    const qs = new URLSearchParams(
      Object.entries(merged).filter(([, v]) => v) as [string, string][],
    );
    const s = qs.toString();
    return s ? `/tiere?${s}` : "/tiere";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-brand-900">
        Sie suchen ein Zuhause
      </h1>
      <p className="mt-3 max-w-[65ch] leading-relaxed text-ink/70">
        {list.length}{" "}
        {list.length === 1 ? "Tier wartet gerade" : "Tiere warten gerade"} bei
        uns. Ein Kennenlerngespräch ist immer der erste Schritt.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <FilterPill href={buildHref({})} active={Object.keys(filters).length === 0}>
          Alle
        </FilterPill>
        {(Object.keys(SPECIES_LABELS) as Animal["species"][])
          .filter((s) => all.some((a) => a.species === s))
          .map((s) => (
            <FilterPill
              key={s}
              href={buildHref({ species: s })}
              active={filters.species === s && !filters.status}
            >
              {SPECIES_LABELS[s]}
            </FilterPill>
          ))}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-brand-100" />
        {(Object.keys(STATUS_LABELS) as Animal["status"][]).map((st) => (
          <FilterPill
            key={st}
            href={buildHref({ status: st })}
            active={filters.status === st}
          >
            {STATUS_LABELS[st]}
          </FilterPill>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-12 rounded-3xl bg-white p-10 text-center ring-1 ring-brand-100">
          <p className="font-display text-xl font-semibold text-brand-900">
            Aktuell keine Tiere in dieser Auswahl
          </p>
          <p className="mt-2 text-ink/60">
            Schauen Sie bald wieder vorbei oder melden Sie sich bei uns – neue
            Tiere treffen regelmäßig ein.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} />
          ))}
        </div>
      )}
    </main>
  );
}
