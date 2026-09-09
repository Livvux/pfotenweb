import Image from "next/image";
import Link from "next/link";
import { SPECIES_LABELS, STATUS_LABELS, getAnimals } from "@/lib/animals";
import { deleteAnimal, setAnimalStatus } from "@/lib/actions/animals";
import { requireAdmin } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/confirm-button";

const STATUS_OPTIONEN = ["vermittelbar", "reserviert", "vermittelt"] as const;

export default async function AdminTierePage() {
  const { scope } = await requireAdmin();
  const animals = await getAnimals(scope);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Tiere
        </h1>
        <Link
          href="/admin/tiere/neu"
          className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + Neues Tier
        </Link>
      </div>

      {animals.length === 0 ? (
        <p className="mt-8 text-sm text-ink/50">Noch keine Tiere angelegt.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {animals.map((animal) => (
            <li key={animal.id} className="p-4">
              <div className="flex items-center gap-4">
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
                {STATUS_OPTIONEN.map((option) => {
                  const aktiv = animal.status === option;
                  return (
                    <button
                      key={option}
                      type="submit"
                      name="status"
                      value={option}
                      aria-pressed={aktiv}
                      className={
                        aktiv
                          ? "rounded-full bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white"
                          : "rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
                      }
                    >
                      {STATUS_LABELS[option]}
                    </button>
                  );
                })}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
