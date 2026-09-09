"use client";

import { useActionState, useState } from "react";
import type { Animal } from "@/lib/animals";
import type { AnimalFormState } from "@/lib/actions/animals";
import { createAnimal, updateAnimal } from "@/lib/actions/animals";
import {
  CheckboxField,
  FormAlert,
  SelectField,
  TextArea,
  TextField,
} from "./fields";
import { PhotoInput } from "./photo-input";

const initial: AnimalFormState = {};

const ARTEN = [
  { value: "hund", label: "Hund" },
  { value: "katze", label: "Katze" },
  { value: "kleintier", label: "Kleintier" },
  { value: "vogel", label: "Vogel" },
  { value: "sonstiges", label: "Sonstiges" },
];

const GESCHLECHTER = [
  { value: "m", label: "männlich" },
  { value: "w", label: "weiblich" },
  { value: "u", label: "unbekannt" },
];

const STATUS = [
  { value: "vermittelbar", label: "Vermittelbar" },
  { value: "reserviert", label: "Reserviert" },
  { value: "vermittelt", label: "Vermittelt" },
];

export function AnimalForm({ animal }: { animal?: Animal }) {
  const [state, formAction, pending] = useActionState(
    animal ? updateAnimal : createAnimal,
    initial,
  );
  // Sperrt Speichern, solange die Fotos im Browser umgewandelt werden. Ohne das
  // tippt jemand auf Speichern und schickt eine halbe Auswahl ab.
  const [fotosBusy, setFotosBusy] = useState(false);
  const feld = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {animal ? <input type="hidden" name="id" value={animal.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label="Name"
          required
          defaultValue={animal?.name}
          error={feld.name}
        />
        <SelectField
          name="species"
          label="Art"
          required
          defaultValue={animal?.species ?? "hund"}
          options={ARTEN}
          error={feld.species}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <SelectField
          name="sex"
          label="Geschlecht"
          required
          defaultValue={animal?.sex ?? "u"}
          options={GESCHLECHTER}
          error={feld.sex}
        />
        <TextField
          name="birthYear"
          label="Geburtsjahr"
          type="number"
          min={1990}
          max={new Date().getFullYear()}
          defaultValue={animal?.birthYear ?? undefined}
          error={feld.birthYear}
        />
        <TextField
          name="size"
          label="Größe"
          placeholder="klein / mittel / groß"
          defaultValue={animal?.size ?? undefined}
          error={feld.size}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField
            name="breed"
            label="Rasse"
            defaultValue={animal?.breed ?? undefined}
            error={feld.breed}
          />
        </div>
        <SelectField
          name="status"
          label="Status"
          required
          defaultValue={animal?.status ?? "vermittelbar"}
          options={STATUS}
          error={feld.status}
        />
      </div>

      <TextArea
        name="description"
        label="Beschreibung"
        required
        rows={6}
        defaultValue={animal?.description}
        error={feld.description}
        hint="Charakter, Vorgeschichte, was das Tier braucht. Mindestens 20 Zeichen."
      />

      <PhotoInput
        label={`Fotos hochladen${animal ? " (zusätzlich)" : ""}`}
        hint="Mehrere Fotos auf einmal möglich, höchstens 8. Große Handyfotos werden vor dem Absenden automatisch verkleinert."
        error={feld.photos}
        onBusyChange={setFotosBusy}
      />

      <CheckboxField
        name="featured"
        label="Auf der Startseite zeigen"
        defaultChecked={animal?.featured}
      />

      {/* Genau ein role="alert" pro Formular, siehe Kommentar in fields.tsx */}
      <FormAlert state={state} />

      <button
        type="submit"
        disabled={pending || fotosBusy}
        className="rounded-full bg-brand-800 px-7 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
      >
        {fotosBusy
          ? "Fotos werden vorbereitet …"
          : pending
            ? "Speichert …"
            : animal
              ? "Änderungen speichern"
              : "Tier anlegen"}
      </button>
    </form>
  );
}
