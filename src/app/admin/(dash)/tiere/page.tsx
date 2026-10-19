import { AnimalStatusButtons } from "@/components/admin/animal-status-switch";
import { SubmitOnChange } from "@/components/admin/submit-on-change";
import Image from "next/image";
import Link from "next/link";
import { SPECIES_LABELS, STATUS_LABELS, getAnimals, countAnimals, type Animal, type AnimalFilters } from "@/lib/animals";
import { deleteAnimal, setAnimalStatus } from "@/lib/actions/animals";
import { requireArea } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/confirm-button";

const STATUS_OPTIONEN = ["vermittelbar", "reserviert", "vermittelt"] as const;

export default async function AdminTierePage({ searchParams }: PageProps<"/admin/tiere">) {
  const { scope } = await requireArea("animals");
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const status = value("status");
  const q = value("q").trim().slice(0, 120);
  const filters: AnimalFilters = { q, ...(Object.hasOwn(STATUS_LABELS, status) ? { status: status as Animal["status"] } : {}) };
  const total = await countAnimals(scope, filters);
  const pages = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(pages, Math.max(1, Number.parseInt(value("seite"), 10) || 1));
  const animals = await getAnimals(scope, { ...filters, limit: 24, offset: (page - 1) * 24 });
  const pageHref = (number: number) => `/admin/tiere?${new URLSearchParams({ q, status, seite: String(number) })}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Tiere
        </h1>
        <Link
          href="/admin/tiere/neu"
          className="animal-create rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + Neues Tier
        </Link>
      </div>

      <form action="/admin/tiere" method="get" className="mt-6 flex flex-wrap items-end gap-3" role="search" aria-label="Tierverwaltung durchsuchen">
        <label className="grid gap-1 text-sm">Suchen<input name="q" type="search" defaultValue={q} maxLength={120} className="rounded-lg border p-2" /></label>
        <label className="grid gap-1 text-sm">Vermittlungsstatus<select name="status" defaultValue={status} className="rounded-lg border p-2"><option value="">Alle</option>{STATUS_OPTIONEN.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <SubmitOnChange /><button className="admin-button" type="submit">Filtern</button><Link href="/admin/tiere" className="inline-flex min-h-11 items-center underline">Zurücksetzen</Link>
      </form>
      <p className="mt-3 text-sm">{total} Tiere in dieser Auswahl</p>
      {animals.length === 0 ? (
        <p className="mt-8 text-sm text-ink/50">Keine Tiere in dieser Auswahl.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {animals.map((animal) => (
            <li key={animal.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/tiere/${animal.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg" aria-label={`${animal.name} bearbeiten`}>
                <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-bone">
                  {animal.images[0] ? (
                    <Image
                      src={animal.images[0].url}
            unoptimized={animal.images[0].url.startsWith("/uploads/t")}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{animal.name}</p>
                  <p className="text-sm text-ink/50">
                    {SPECIES_LABELS[animal.species]}
                    {animal.featured ? " · Startseite" : ""}
                  </p>
                </div>
                </Link>
                <Link
                  href={`/admin/tiere/${animal.id}`}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  Bearbeiten
                </Link>
                <form action={deleteAnimal}>
                  <input type="hidden" name="id" value={animal.id} />
                  <ConfirmButton
                    question={`${animal.name}${
                      animal.images.length > 0
                        ? ` und ${animal.images.length} ${
                            animal.images.length === 1 ? "Foto" : "Fotos"
                          }`
                        : ""
                    } werden gelöscht.`}
                  />
                </form>
              </div>

              {/*
               * Drei Submit-Knoepfe in einem Formular. Ein Submit-Knopf sendet
               * sein eigenes name und value mit, der Statuswechsel braucht also
               * kein einziges Byte JavaScript, und der aktuelle Status bleibt
               * als hervorgehobener Knopf sichtbar.
               *
               * Das versteckte Feld heisst tierId, nicht id: sonst traefe der
               * E2E-Selektor input[name="id"] zwei Formulare in dieser Zeile.
               */}
              <form action={setAnimalStatus} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="tierId" value={animal.id} />
                <AnimalStatusButtons current={animal.status} options={STATUS_OPTIONEN.map(value => [value, STATUS_LABELS[value]])} />
              </form>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? <nav aria-label="Tierlistenseiten" className="mt-6 flex flex-wrap gap-4">{page > 1 && <Link className="admin-button" href={pageHref(page - 1)}>Zurück</Link>}<span className="py-3">Seite {page} von {pages}</span>{page < pages && <Link className="admin-button" href={pageHref(page + 1)}>Weiter</Link>}</nav> : null}
    </div>
  );
}
