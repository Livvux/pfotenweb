"use client";

import Image from "next/image";
import { useOptimistic } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ConfirmButton } from "./confirm-button";

type Photo = { id: number; url: string };
type Op = { id: number; move: -1 | 1 } | { id: number; remove: true };

const steps = [
  { move: -1, richtung: "vor", label: "nach vorne", Icon: ArrowLeft },
  { move: 1, richtung: "zurueck", label: "nach hinten", Icon: ArrowRight },
] as const;

/**
 * Gespeicherte Fotos sortieren und loeschen.
 *
 * Die Kachel rueckt sofort an ihren neuen Platz bzw. verschwindet; der Server
 * bestaetigt im Hintergrund und liefert danach die echte Reihenfolge. Schlaegt
 * die Aktion fehl, springt die Ansicht auf den gespeicherten Stand zurueck.
 *
 * Hoch und Runter statt Ziehen: auf dem Smartphone kollidiert Drag-and-Drop
 * mit dem Scrollen, und ohne Maus ist es gar nicht bedienbar. Bei drei bis
 * fuenf Fotos ist Tippen ohnehin schneller.
 *
 * Kein <figure>: die Auswahlvorschau neuer Fotos wird in Tests darueber gezaehlt.
 */
export function AnimalPhotoManager({
  images,
  move,
  remove,
}: {
  images: Photo[];
  move: (form: FormData) => Promise<void>;
  remove: (form: FormData) => Promise<void>;
}) {
  const [photos, apply] = useOptimistic(images, (list: Photo[], op: Op) => {
    if ("remove" in op) return list.filter((photo) => photo.id !== op.id);
    const from = list.findIndex((photo) => photo.id === op.id);
    const to = from + op.move;
    if (from < 0 || to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
  // Formularaktionen laufen bereits in einer Transition; dort darf apply stehen.
  const act = (op: Op, action: (form: FormData) => Promise<void>) => async (form: FormData) => {
    apply(op);
    await action(form);
  };

  return (
    <div className="admin-photo-manage">
      {photos.map((img, i) => (
        <div key={img.id}>
          <div className="relative aspect-square overflow-hidden rounded-[14px] bg-bone ring-1 ring-stone-200">
            <Image
              src={img.url}
              unoptimized={img.url.startsWith("/uploads/t")}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 180px"
              className="object-cover"
            />
            {i === 0 ? <span className="admin-photo-cover">Titelbild</span> : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {steps.map(({ move: step, richtung, label, Icon }) => (
              <form key={richtung} action={act({ id: img.id, move: step }, move)}>
                <input type="hidden" name="imageId" value={img.id} />
                <input type="hidden" name="richtung" value={richtung} />
                <button
                  type="submit"
                  disabled={i + step < 0 || i + step >= photos.length}
                  aria-label={`Foto ${i + 1} ${label}`}
                  className="admin-button w-full"
                >
                  <Icon size={18} aria-hidden="true" />
                </button>
              </form>
            ))}
          </div>
          <form action={act({ id: img.id, remove: true }, remove)}>
            <input type="hidden" name="imageId" value={img.id} />
            {/* Zweistufig wie ueberall: der erste Klick fragt nur nach. */}
            <ConfirmButton label="Foto löschen" confirmLabel="Wirklich löschen" className="mt-2 w-full" />
          </form>
        </div>
      ))}
    </div>
  );
}
