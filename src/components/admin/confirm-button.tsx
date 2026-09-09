"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Zweistufiges Loeschen direkt in der Zeile.
 *
 * Der erste Klick ist ein type="button" und schickt nichts ab, er schaltet nur
 * scharf. Erst der zweite Knopf ist ein echter Submit. Ohne JavaScript bleibt
 * es beim type="button" und es wird nichts geloescht: die sichere Fehlrichtung.
 *
 * Bewusst kein <dialog>: ein Modal springt in die Bildschirmmitte, also weg vom
 * Finger, der gerade auf der Zeile lag, und bringt Fokusfallen sowie
 * Scroll-Lock-Aerger in mobilem Safari mit. Bewusst kein confirm(): blockiert,
 * nicht gestaltbar, wirkt wie ein Systemfehler.
 */
export function ConfirmButton({
  label = "Löschen",
  confirmLabel = "Wirklich löschen",
  question,
  className,
}: {
  label?: string;
  confirmLabel?: string;
  /** Was verloren geht, etwa "Balou und 3 Fotos werden gelöscht." */
  question?: string;
  className?: string;
}) {
  const [scharf, setScharf] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Unbeaufsichtigt scharf stehen bleiben waere die eigentliche Falle: wer die
  // Zeile verwechselt, findet den Knopf spaeter schon geladen vor.
  useEffect(() => {
    if (!scharf) return;
    timer.current = setTimeout(() => setScharf(false), 8000);
    return () => clearTimeout(timer.current);
  }, [scharf]);

  const basis =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60";

  if (!scharf) {
    return (
      <button
        type="button"
        onClick={() => setScharf(true)}
        className={
          className ??
          `${basis} border border-red-200 text-red-700 hover:bg-red-50`
        }
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {question ? (
        <span className="text-sm text-ink/60">{question}</span>
      ) : null}
      <button
        type="submit"
        autoFocus
        className={`${basis} bg-red-600 text-white hover:bg-red-700`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setScharf(false)}
        className={`${basis} border border-stone-300 text-stone-700 hover:bg-stone-100`}
      >
        Abbrechen
      </button>
    </span>
  );
}
