"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { shrinkImage } from "@/lib/shrink-image";
import { Rahmen, beschriebenVon } from "./fields";

type Auswahl = { file: File; url: string };

/**
 * Mehrere Fotos auswaehlen, im Browser verkleinern, in denselben Input
 * zurueckschreiben.
 *
 * accept="image/*" statt der drei MIME-Typen ist Absicht: sonst blendet iOS
 * Teile der Kamerarolle aus, und HEIC waere gar nicht erst waehlbar. Ohne
 * capture-Attribut bietet das Smartphone Kamera UND Galerie an. Der Server
 * prueft weiterhin streng.
 *
 * Der Rueckweg laeuft ueber DataTransfer und nicht ueber ein selbstgebautes
 * Submit. Nur so bleibt das Formular ein gewoehnliches <form action={...}> mit
 * useActionState, ohne onSubmit-Handler und ohne manuelles startTransition.
 * Dieselbe Zuweisung erlaubt es, Fotos nacheinander anzuhaengen und einzelne
 * wieder zu entfernen: der Input haelt immer genau die sichtbare Auswahl. Ein
 * abgebrochener Dialog aendert input.files in aktuellen Browsern nicht.
 *
 * Drei Rueckfallebenen: schlaegt shrinkImage fehl, geht das Original durch.
 * Laesst sich input.files nicht zuweisen, ersetzt jede Auswahl die vorige und
 * Entfernen entfaellt. Ist JavaScript ganz aus, ist es ein gewoehnliches
 * Dateifeld. Der Server bleibt in allen Faellen die einzige verbindliche Pruefung.
 */
export function PhotoInput({
  name = "photos",
  multiple = true,
  label,
  hint,
  error,
  onBusyChange,
  onPreviewChange,
}: {
  name?: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  error?: string;
  /** Sperrt den Speichern-Knopf, solange umgewandelt wird. */
  onBusyChange?: (busy: boolean) => void;
  /** Local URLs remain owned and cleaned up by this input. */
  onPreviewChange?: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [auswahl, setAuswahl] = useState<Auswahl[]>([]);
  const [editierbar, setEditierbar] = useState(true);
  const aktuell = useRef<Auswahl[]>([]);

  // Objekt-URLs erst beim Verlassen freigeben; entfernte Fotos sofort.
  useEffect(() => () => aktuell.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  function uebernehmen(next: Auswahl[]) {
    const input = inputRef.current;
    let ok = true;
    if (input) {
      try {
        const dt = new DataTransfer();
        next.forEach((a) => dt.items.add(a.file));
        input.files = dt.files;
      } catch {
        // Zuweisung nicht moeglich: der Input haelt die letzte Originalauswahl.
        ok = false;
      }
    }
    setEditierbar(ok);
    const behalten = new Set(next.map((a) => a.url));
    aktuell.current.filter((a) => !behalten.has(a.url)).forEach((a) => URL.revokeObjectURL(a.url));
    aktuell.current = next;
    setAuswahl(next);
    onPreviewChange?.(next.map((a) => a.url));
  }

  async function onChange() {
    const input = inputRef.current;
    const neu = Array.from(input?.files ?? []);
    // Leeres Feld heisst leere Auswahl, wie beim gewoehnlichen Dateifeld.
    if (neu.length === 0) return uebernehmen([]);
    const bisher = multiple && editierbar ? aktuell.current : [];

    setBusy(true);
    onBusyChange?.(true);
    try {
      const fertig = await Promise.all(neu.map((f) => shrinkImage(f).catch(() => f)));
      uebernehmen([...bisher, ...fertig.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const basis = { name, label, error, hint };
  const anhaengen = multiple && auswahl.length > 0;
  const titel = busy
    ? "Fotos werden vorbereitet …"
    : anhaengen
      ? "Weitere Fotos hinzufügen"
      : multiple
        ? "Foto aufnehmen oder auswählen"
        : "Bild auswählen";
  return (
    <Rahmen {...basis}>
      <div className="admin-photo-drop">
        <span className="admin-photo-drop-icon" aria-hidden="true">
          <Camera size={24} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">{titel}</span>
          <span className="mt-0.5 block text-sm text-stone-500">
            {anhaengen ? `${auswahl.length} ausgewählt` : "Kamera oder Galerie"}
          </span>
        </span>
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="file"
          disabled={busy}
          multiple={multiple}
          accept="image/*"
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={beschriebenVon(basis)}
        />
      </div>

      {auswahl.length > 0 && !busy ? (
        <div className="admin-photo-grid">
          {auswahl.map((a, i) => (
            <figure key={a.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={`Ausgewähltes Foto ${i + 1}`} />
              {multiple && i === 0 ? <span className="admin-photo-cover">Titelbild</span> : null}
              {editierbar ? (
                <button
                  type="button"
                  className="admin-photo-remove"
                  aria-label={`Ausgewähltes Foto ${i + 1} entfernen`}
                  onClick={() => uebernehmen(auswahl.filter((b) => b !== a))}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
    </Rahmen>
  );
}
