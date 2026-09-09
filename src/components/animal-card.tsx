import Image from "next/image";
import Link from "next/link";
import type { AnimalWithImages } from "@/lib/animals";
import {
  SPECIES_LABELS,
  STATUS_LABELS,
  ageText,
} from "@/lib/animals";

const statusStyles = {
  vermittelbar: "bg-brand-100 text-brand-800",
  reserviert: "bg-accent-200 text-accent-700",
  vermittelt: "bg-stone-200 text-stone-600",
} as const;

export function AnimalCard({ animal }: { animal: AnimalWithImages }) {
  const cover = animal.images[0];

  return (
    <Link
      href={`/tiere/${animal.slug}`}
      className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-950/10"
    >
      <div className="relative aspect-[4/3] bg-bone">
        {cover ? (
          <Image
            src={cover.url}
            unoptimized={cover.url.startsWith("/uploads/t")}
            alt={`${animal.name}, ${SPECIES_LABELS[animal.species]}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[animal.status]}`}
        >
          {STATUS_LABELS[animal.status]}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-brand-900">
            {animal.name}
          </h2>
          <span className="text-sm text-ink/50">
            {ageText(animal)}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          {SPECIES_LABELS[animal.species]}
          {animal.breed ? ` · ${animal.breed}` : ""}
          {animal.sex === "m" || animal.sex === "w"
            ? ` · ${animal.sex === "m" ? "männlich" : "weiblich"}`
            : ""}
        </p>
      </div>
    </Link>
  );
}
