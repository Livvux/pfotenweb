import { publicAnimalFacts } from "@/lib/public-animal-facts";
import { STATUS_LABELS } from "@/lib/animals";
import { AnimalExternalHelp } from "@/components/admin/animal-external-help";
import { AnimalPhotoManager } from "@/components/admin/animal-photo-manager";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimalByIdForAdmin } from "@/lib/animals";
import { requireArea } from "@/lib/auth";
import { AnimalForm } from "@/components/admin/animal-form";
import { deleteAnimalImage, moveAnimalImage } from "@/lib/actions/animals";

export default async function TierBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireArea("animals");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // Tier eines fremden Vereins ist hier schlicht nicht auffindbar.
  const animal = await getAnimalByIdForAdmin(scope, id);
  if (!animal) notFound();

  const images = animal.images;

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/tiere"
        className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
      >
        ← Tiere
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
        {animal.name} bearbeiten
      </h1>

      {images.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-1 text-sm font-semibold text-ink/60">Fotos</h2>
          <p className="mb-3 text-sm text-ink/50">
            Das erste Foto ist das Titelbild. Es steht in der Tierliste und auf
            der Startseite.
          </p>
          <AnimalPhotoManager images={images} move={moveAnimalImage} remove={deleteAnimalImage} />
        </div>
      ) : null}

      <AnimalExternalHelp id={animal.id} status={animal.status} images={images} profile={[animal.name, ...publicAnimalFacts(animal, animal.profile).map(([label, value]) => `${label}: ${value}`), `Status: ${STATUS_LABELS[animal.status]}`, "", animal.description].join("\n")}/>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <AnimalForm animal={animal} coverImage={images[0]?.url} />
      </div>
    </div>
  );
}
