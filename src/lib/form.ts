import { flattenError, z } from "zod";

/**
 * Zustand jedes Admin-Formulars, gemeinsam fuer alle Server Actions.
 *
 * `error` ist die Zusammenfassung und wird oben im Formular mit role="alert"
 * gerendert. `fieldErrors` haengt die Meldung an das jeweilige Feld.
 */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Fuer Formulare, die nach dem Speichern stehen bleiben statt umzuleiten. */
  success?: boolean;
};

/**
 * Macht aus einem zod-Fehler den Formularzustand.
 *
 * `error` bleibt bewusst die erste Issue-Meldung und nicht ein allgemeiner
 * Satz: die E2E-Tests pruefen exakt darauf (e2e/kontakt.spec.ts), und fuer ein
 * Formular mit drei Feldern ist die konkrete Meldung ohnehin die bessere.
 *
 * zod 4 hat `error.flatten()` abgeloest. `flattenError` ist der Nachfolger,
 * die Next-Doku unter 02-guides/forms.md zeigt noch die alte Form.
 */
export function zodErrorState(error: z.ZodError): FormState {
  const flat = flattenError(error);
  const fieldErrors: Record<string, string> = {};
  for (const [feld, meldungen] of Object.entries(flat.fieldErrors)) {
    const erste = (meldungen as string[] | undefined)?.[0];
    if (erste) fieldErrors[feld] = erste;
  }
  return {
    error: error.issues[0]?.message ?? "Eingabe ungültig.",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

/**
 * Ein Textfeld aus dem Formular.
 *
 * formData.get liefert null, wenn das Feld gar nicht mitgeschickt wurde, etwa
 * weil ein Formular umgebaut wurde. Ohne die Umwandlung meldet zod dann
 * „expected string, received null“ statt der fachlichen Regel.
 */
export function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

/** Die ID eines eigenen Datensatzes, wie sie aus einem versteckten Feld kommt. */
export const idSchema = z.coerce.number().int().positive();

/**
 * Verletzung eines Unique-Index (Postgres 23505).
 *
 * Geprueft wird am Fehlercode der Datenbank, nicht mit einem SELECT davor. Ein
 * Vorabblick waere race-anfaellig: zwischen Pruefung und INSERT passt ein
 * zweiter Schreibvorgang.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}
