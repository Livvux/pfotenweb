import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimalByIdForAdmin } from "@/lib/animals";
import { requireAdmin } from "@/lib/auth";
import { AnimalForm } from "@/components/admin/animal-form";
import { deleteAnimalImage, moveAnimalImage } from "@/lib/actions/animals";
import { ConfirmButton } from "@/components/admin/confirm-button";

export default async function TierBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireAdmin();
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
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={img.id} className="w-32">
                <div className="relative h-24 w-32 overflow-hidden rounded-xl bg-bone ring-1 ring-stone-200">
                  <Image
                    src={img.url}
            unoptimized={img.url.startsWith("/uploads/t")}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                  {i === 0 ? (
                    <span className="absolute bottom-0 left-0 right-0 bg-brand-800/85 px-2 py-0.5 text-center text-[11px] font-semibold text-white">
                      Titelbild
                    </span>
                  ) : null}
                </div>

                {/*
                 * Hoch und Runter statt Ziehen: auf dem Handy kollidiert
                 * Drag-and-Drop mit dem Scrollen, und ohne Maus ist es gar
                 * nicht bedienbar. Bei drei bis fuenf Fotos ist Tippen ohnehin
                 * schneller.
                 */}
                <div className="mt-2 flex gap-2">
                  <form action={moveAnimalImage} className="flex-1">
                    <input type="hidden" name="imageId" value={img.id} />
                    <input type="hidden" name="richtung" value="vor" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      aria-label={`Foto ${i + 1} nach vorne`}
                      className="w-full rounded-lg border border-stone-300 py-1 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-30"
                    >
                      ←
                    </button>
                  </form>
                  <form action={moveAnimalImage} className="flex-1">
                    <input type="hidden" name="imageId" value={img.id} />
                    <input type="hidden" name="richtung" value="zurueck" />
                    <button
                      type="submit"
                      disabled={i === images.length - 1}
                      aria-label={`Foto ${i + 1} nach hinten`}
                      className="w-full rounded-lg border border-stone-300 py-1 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-30"
                    >
                      →
                    </button>
                  </form>
                </div>

                <form action={deleteAnimalImage}>
                  <input type="hidden" name="imageId" value={img.id} />
                  {/* Zweistufig wie ueberall: der erste Klick fragt nur nach. */}
                  <ConfirmButton
                    label="Foto löschen"
                    confirmLabel="Wirklich löschen"
                    className="mt-2 w-full rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                  />
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <AnimalForm animal={animal} />
      </div>
    </div>
  );
}
