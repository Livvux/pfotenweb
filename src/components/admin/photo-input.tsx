"use client";

import { useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/lib/shrink-image";
import { Rahmen, beschriebenVon, fileClass } from "./fields";

type Vorschau = { url: string; name: string; kb: number };

/**
 * Mehrere Fotos auswaehlen, im Browser verkleinern, in denselben Input
 * zurueckschreiben.
 *
 * accept="image/*" statt der drei MIME-Typen ist Absicht: sonst blendet iOS
 * Teile der Kamerarolle aus, und HEIC waere gar nicht erst waehlbar. Der Server
 * prueft weiterhin streng.
 *
 * Der Rueckweg laeuft ueber DataTransfer und nicht ueber ein selbstgebautes
 * Submit. Nur so bleibt das Formular ein gewoehnliches <form action={...}> mit
 * useActionState, ohne onSubmit-Handler und ohne manuelles startTransition.
 *
 * Drei Rueckfallebenen: schlaegt shrinkImage fehl, geht das Original durch.
 * Laesst sich input.files nicht zuweisen, ebenso. Ist JavaScript ganz aus, ist
 * es ein gewoehnliches Dateifeld. Der Server bleibt in allen Faellen die
 * einzige verbindliche Pruefung.
 */
export function PhotoInput({
  label,
  hint,
  error,
  onBusyChange,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Sperrt den Speichern-Knopf, solange umgewandelt wird. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau[]>([]);

  // Objekt-URLs freigeben, sonst haelt der Browser jedes Bild im Speicher.
  useEffect(() => {
    return () => vorschau.forEach((v) => URL.revokeObjectURL(v.url));
  }, [vorschau]);

  async function onChange() {
    const input = inputRef.current;
    if (!input?.files || input.files.length === 0) {
      setVorschau([]);
      return;
    }
    const originale = Array.from(input.files);

    setBusy(true);
    onBusyChange?.(true);
    try {
      const fertig = await Promise.all(
        originale.map((f) => shrinkImage(f).catch(() => f)),
      );
      try {
        const dt = new DataTransfer();
        fertig.forEach((f) => dt.items.add(f));
        input.files = dt.files;
      } catch {
        // Zuweisung nicht moeglich: die Originale bleiben im Feld stehen.
      }
      setVorschau(
        fertig.map((f) => ({
          url: URL.createObjectURL(f),
          name: f.name,
          kb: Math.round(f.size / 1024),
        })),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const basis = { name: "photos", label, error, hint };
  return (
    <Rahmen {...basis}>
      <input
        ref={inputRef}
        id="photos"
        name="photos"
        type="file"
        multiple
        accept="image/*"
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={beschriebenVon(basis)}
        className={fileClass}
      />

      {busy ? (
        <p className="mt-2 text-sm font-medium text-brand-800">
          Fotos werden vorbereitet …
        </p>
      ) : null}

      {vorschau.length > 0 && !busy ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {vorschau.map((v) => (
            <figure key={v.url} className="w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.url}
                alt=""
                className="h-20 w-24 rounded-lg bg-bone object-cover ring-1 ring-stone-200"
              />
              <figcaption className="mt-1 truncate text-xs text-ink/50">
                {v.kb} KB
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </Rahmen>
  );
}
