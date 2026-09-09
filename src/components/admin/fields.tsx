/*
 * Formularfelder fuer den Adminbereich.
 *
 * ACHTUNG, zwei Dinge duerfen hier nicht verrutschen:
 *
 * 1. Das Label rendert `label + " *"` bei required. Die E2E-Tests selektieren
 *    ueber genau diese Texte (getByLabel("Name *"), "Art *", "Status *",
 *    "Beschreibung *", "Titel *", "Beitrag *"). Wer das Sternchen anders setzt,
 *    bricht e2e/admin-tiere.spec.ts und e2e/admin-aktuelles.spec.ts.
 *
 * 2. Der Feldfehler traegt KEIN role="alert". e2e/utils.ts selektiert
 *    p[role="alert"] und admin-auth.spec.ts prueft darauf mit toHaveText. Ein
 *    zweites Element mit dieser Rolle loest Playwrights Strict Mode aus. Genau
 *    ein role="alert" pro Formular, oben, mit der Zusammenfassung.
 */

import type { ReactNode } from "react";
import type { FormState } from "@/lib/form";

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/20";

/** Dateifelder, also Tierfotos, Logo und Startbild. */
export const fileClass =
  "block w-full text-sm text-stone-500 file:mr-4 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand-800 hover:file:bg-brand-100";

/**
 * Die eine Zusammenfassung oben im Formular.
 *
 * Der einzige Ort im Projekt, der role="alert" setzt. Steht als Komponente da,
 * damit Punkt 2 oben nicht in zehn Formularen von Hand eingehalten werden muss.
 */
export function FormAlert({ state }: { state: FormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {state.error}
    </p>
  );
}

export type Basis = {
  name: string;
  /**
   * Abweichende HTML-id, falls dasselbe Feld mehrfach auf einer Seite steht.
   *
   * Auf /admin/team gibt es je Zeile ein Formular mit name="password". Ohne
   * eigene id waeren die ids doppelt vergeben, und ein Klick aufs Label traefe
   * immer dasselbe erste Feld.
   */
  id?: string;
  label: string;
  error?: string;
  required?: boolean;
  /** Erklaerung unter dem Feld. Fuer Ehrenamtliche oft wichtiger als das Label. */
  hint?: string;
};

/**
 * Label, Hinweis und Fehlermeldung, gemeinsam fuer alle Feldarten.
 *
 * Exportiert, weil ein Dateifeld und ein Farbwaehler nicht in die vier
 * fertigen Komponenten passen, aber dieselbe aria-Verdrahtung brauchen.
 */
export function Rahmen({
  name,
  id,
  label,
  error,
  required,
  hint,
  children,
}: Basis & { children: ReactNode }) {
  const feld = id ?? name;
  return (
    <div>
      <label htmlFor={feld} className="mb-1 block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${feld}-hinweis`} className="mt-1 text-sm text-ink/50">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${feld}-fehler`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby zeigt auf Fehler ODER Hinweis, nie auf beides. */
export function beschriebenVon(basis: Basis) {
  const feld = basis.id ?? basis.name;
  if (basis.error) return `${feld}-fehler`;
  if (basis.hint) return `${feld}-hinweis`;
  return undefined;
}

export function TextField({
  type = "text",
  defaultValue,
  onChange,
  placeholder,
  min,
  max,
  autoComplete,
  ...basis
}: Basis & {
  type?: "text" | "number" | "email" | "tel" | "password";
  defaultValue?: string | number | null;
  /**
   * Nur mithoeren, nicht steuern. Die Felder bleiben unkontrolliert mit
   * defaultValue, so wie es useActionState vorsieht. Gebraucht wird das bisher
   * nur bei der Anmeldung, wo Vereinsname und Wunschadresse zusammen eine
   * Vorschauzeile speisen.
   */
  onChange?: (wert: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  autoComplete?: string;
}) {
  return (
    <Rahmen {...basis}>
      <input
        id={basis.id ?? basis.name}
        name={basis.name}
        type={type}
        required={basis.required}
        defaultValue={defaultValue ?? undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        min={min}
        max={max}
        autoComplete={autoComplete}
        aria-invalid={basis.error ? true : undefined}
        aria-describedby={beschriebenVon(basis)}
        className={inputClass}
      />
    </Rahmen>
  );
}

export function TextArea({
  defaultValue,
  rows = 6,
  placeholder,
  ...basis
}: Basis & { defaultValue?: string | null; rows?: number; placeholder?: string }) {
  return (
    <Rahmen {...basis}>
      <textarea
        id={basis.id ?? basis.name}
        name={basis.name}
        required={basis.required}
        rows={rows}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        aria-invalid={basis.error ? true : undefined}
        aria-describedby={beschriebenVon(basis)}
        className={inputClass}
      />
    </Rahmen>
  );
}

export function SelectField({
  defaultValue,
  options,
  ...basis
}: Basis & {
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Rahmen {...basis}>
      <select
        id={basis.id ?? basis.name}
        name={basis.name}
        defaultValue={defaultValue}
        aria-invalid={basis.error ? true : undefined}
        aria-describedby={beschriebenVon(basis)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Rahmen>
  );
}

/*
 * Checkbox ohne Rahmen: Label rechts neben dem Kaestchen statt darueber, und
 * ohne Sternchen. Die E2E-Tests treffen sie ueber den vollen Text, etwa
 * getByLabel("Veroeffentlicht (oeffentlich sichtbar)").
 */
export function CheckboxField({
  name,
  id,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  id?: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const feld = id ?? name;
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          id={feld}
          name={name}
          defaultChecked={defaultChecked}
          aria-describedby={hint ? `${feld}-hinweis` : undefined}
          className="h-4 w-4 rounded border-stone-300 accent-brand-700"
        />
        {label}
      </label>
      {hint ? (
        <p id={`${feld}-hinweis`} className="mt-1 ml-6 text-sm text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
