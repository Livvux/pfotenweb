"use client";

import { useActionState, useState } from "react";
import type { TenantSettings } from "@/lib/tenant";
import type { FormState } from "@/lib/form";
import {
  updateVereinErscheinungsbild,
  updateVereinStartseite,
  updateVereinUeberUns,
} from "@/lib/actions/settings";
import { buildThemeVars } from "@/lib/theme";
import {
  CheckboxField,
  Rahmen,
  TextArea,
  beschriebenVon,
  fileClass,
  inputClass,
} from "./fields";
import { SaveBar } from "./save-bar";

const initial: FormState = {};

/**
 * Ein Bildfeld mit aktuellem Stand und „entfernen“-Kaestchen.
 *
 * Das versteckte `<feld>Current` traegt die alte URL zur Action, damit sie die
 * ersetzte Datei von der Platte raeumen kann. Ohne das waechst uploads/t<id>/
 * bei jedem Logowechsel weiter.
 */
function BildFeld({
  name,
  label,
  current,
  error,
  hint,
}: {
  name: string;
  label: string;
  current: string | null;
  error?: string;
  hint?: string;
}) {
  const basis = { name, label, error, hint };
  return (
    <Rahmen {...basis}>
      {current ? (
        <div className="mb-3 flex items-center gap-3">
          {/* Kein next/image: Vereins-Upload mit unbekannten Massen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt=""
            className="h-20 w-28 rounded-lg bg-bone object-contain ring-1 ring-stone-200"
          />
          <input type="hidden" name={`${name}Current`} value={current} />
          <CheckboxField name={`${name}Remove`} label="Bild entfernen" />
        </div>
      ) : null}
      <input
        id={name}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={error ? true : undefined}
        aria-describedby={beschriebenVon(basis)}
        className={fileClass}
      />
    </Rahmen>
  );
}

export function StartseiteForm({ settings }: { settings: TenantSettings }) {
  const [state, action, pending] = useActionState(
    updateVereinStartseite,
    initial,
  );
  const feld = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <TextArea
        name="heroHeadline"
        label="Große Überschrift"
        required
        rows={2}
        defaultValue={settings.heroHeadline}
        error={feld.heroHeadline}
        hint="Das Erste, was Besucher lesen. Ein Satz, gerne mit Haltung."
      />
      <TextArea
        name="heroSubline"
        label="Text darunter"
        rows={3}
        defaultValue={settings.heroSubline}
        error={feld.heroSubline}
      />
      <BildFeld
        name="heroImage"
        label="Bild auf der Startseite"
        current={settings.heroImageUrl}
        error={feld.heroImage}
        hint="Ein hochformatiges Foto wirkt am besten. JPEG, PNG oder WebP, bis 5 MB."
      />
      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function UeberUnsForm({ settings }: { settings: TenantSettings }) {
  const [state, action, pending] = useActionState(updateVereinUeberUns, initial);
  const feld = state.fieldErrors ?? {};
  // Vier feste Zeilen: die Vereinsseite legt die Kennzahlen ohnehin in ein
  // vierspaltiges Raster.
  const facts = settings.facts ?? [];
  const zeilen = [0, 1, 2, 3];

  return (
    <form action={action} className="space-y-5">
      <TextArea
        name="aboutIntro"
        label="Wer wir sind"
        rows={6}
        defaultValue={settings.aboutIntro}
        error={feld.aboutIntro}
      />
      <TextArea
        name="aboutWork"
        label="Wie wir arbeiten"
        rows={5}
        defaultValue={settings.aboutWork}
        error={feld.aboutWork}
      />
      <TextArea
        name="aboutSupport"
        label="Was uns trägt"
        rows={5}
        defaultValue={settings.aboutSupport}
        error={feld.aboutSupport}
      />

      <fieldset>
        <legend className="mb-1 block text-sm font-medium">Kennzahlen</legend>
        <p className="mb-3 text-sm text-ink/50">
          Vier Zahlen, die Ihren Verein zeigen. Leere Zeilen fallen weg.
        </p>
        <div className="space-y-3">
          {zeilen.map((i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <input
                name="factValue"
                aria-label={`Kennzahl ${i + 1}, Wert`}
                defaultValue={facts[i]?.value ?? ""}
                placeholder="1987"
                className={inputClass}
              />
              <input
                name="factLabel"
                aria-label={`Kennzahl ${i + 1}, Beschriftung`}
                defaultValue={facts[i]?.label ?? ""}
                placeholder="Vereinsgründung"
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}

/**
 * Farbwaehler mit Textfeld daneben.
 *
 * Der Systemwaehler ist auf dem Handy gut, aber ein Verein, der „unser Gruen
 * ist #1e4334“ auf einem Zettel stehen hat, muss den Wert tippen koennen.
 * Beide Eingaben haengen am selben State, gesendet wird genau ein Feld.
 */
function FarbFeld({
  name,
  label,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const basis = { name, label, error };
  return (
    <Rahmen {...basis}>
      <div className="flex items-center gap-3">
        {/*
          Systemwaehler UND Textfeld auf demselben Zustand: auf dem Handy ist
          der Waehler das Bequemere, aber ein Verein, der „unser Gruen ist
          #1e4334“ auf einem Zettel stehen hat, muss es tippen koennen.
        */}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}, Farbwähler`}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={beschriebenVon(basis)}
          className={inputClass}
        />
      </div>
    </Rahmen>
  );
}

export function ErscheinungsbildForm({
  settings,
}: {
  settings: TenantSettings;
}) {
  const [state, action, pending] = useActionState(
    updateVereinErscheinungsbild,
    initial,
  );
  const feld = state.fieldErrors ?? {};
  const [primary, setPrimary] = useState(settings.colorPrimary);
  const [accent, setAccent] = useState(settings.colorAccent);

  // buildThemeVars ist eine reine Funktion und laeuft auch im Browser. Dieselbe
  // Funktion erzeugt serverseitig die echten Farben, Vorschau und Ergebnis
  // koennen also nicht auseinanderlaufen.
  const vars = buildThemeVars(primary, accent);
  const stufen = [100, 300, 500, 700, 900];

  return (
    <form action={action} className="space-y-5">
      <BildFeld
        name="logo"
        label="Logo"
        current={settings.logoUrl}
        error={feld.logo}
        hint="Quadratisch und mit freigestelltem Hintergrund wirkt am besten. Ohne Logo zeigen wir eine Pfote."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FarbFeld
          name="colorPrimary"
          label="Hauptfarbe"
          value={primary}
          onChange={setPrimary}
          error={feld.colorPrimary}
        />
        <FarbFeld
          name="colorAccent"
          label="Akzentfarbe"
          value={accent}
          onChange={setAccent}
          error={feld.colorAccent}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Vorschau</p>
        <div className="flex gap-1 overflow-hidden rounded-xl ring-1 ring-stone-200">
          {stufen.map((s) => (
            <div
              key={`b${s}`}
              className="h-10 flex-1"
              style={{ background: vars[`--color-brand-${s}`] }}
            />
          ))}
          {stufen.slice(0, 4).map((s) => (
            <div
              key={`a${s}`}
              className="h-10 flex-1"
              style={{ background: vars[`--color-accent-${s}`] }}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-ink/50">
          Aus Ihren beiden Farben entstehen alle Abstufungen der Webseite.
        </p>
      </div>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}
