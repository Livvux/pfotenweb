"use client";

import type { FormState } from "@/lib/form";
import { FormAlert } from "./fields";

/**
 * Fehlerband, Erfolgsband und Speichern-Knopf fuer die Vereinsdaten.
 *
 * Diese Formulare leiten nach dem Speichern bewusst NICHT weiter: hier aendert
 * man mehrere Abschnitte hintereinander und will jedes Mal sehen, dass es
 * geklappt hat. Bei Tieren und Beitraegen bleibt die Weiterleitung, dort ist
 * das Ziel die Liste.
 *
 * Genau ein role="alert" pro Formular, siehe Kommentar in fields.tsx.
 */
export function SaveBar({
  state,
  pending,
  label = "Änderungen speichern",
  successText = "Gespeichert. Die Änderungen sind auf der Webseite sichtbar.",
}: {
  state: FormState;
  pending: boolean;
  label?: string;
  /** Die Vereinsdaten landen auf der Webseite, ein Zugang nicht. */
  successText?: string;
}) {
  return (
    <div className="space-y-4 border-t border-stone-200 pt-5">
      <FormAlert state={state} />
      {state.success ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
          {successText}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-800 px-7 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Speichert …" : label}
      </button>
    </div>
  );
}
