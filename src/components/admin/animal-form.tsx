"use client";

import { publicAnimalFacts } from "@/lib/public-animal-facts";
import { SPECIES_LABELS, STATUS_LABELS } from "@/lib/animal-display";
import { profileFromForm, profileLabels } from "@/lib/animal-profile-fields";
import { matchingOptions } from "@/lib/animal-matching";
import { animalSchema, parseAnimal } from "@/lib/animal-fields";
import { useActionState, useId, useRef, useState } from "react";
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

function ChoiceField({ name, label, defaultValue, options, error }: { name: string; label: string; defaultValue: string; options: { value: string; label: string }[]; error?: string }) {
  const id = useId();
  return <fieldset aria-describedby={error ? `${id}-error` : undefined} className="min-w-0"><legend className="mb-2 text-sm font-medium">{label} *</legend><div className="flex flex-wrap gap-2">{options.map(option => <label key={option.value} className="cursor-pointer"><input className="peer sr-only" type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue}/><span className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-3 text-sm peer-checked:border-brand-800 peer-checked:bg-brand-800 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">{option.label}</span></label>)}</div>{error && <p id={`${id}-error`} className="mt-2 text-sm text-red-800">{error}</p>}</fieldset>;
}

export function AnimalForm({ animal, coverImage }: { animal?: Animal; coverImage?: string | null }) {
  const [state, formAction, pending] = useActionState(
    animal ? updateAnimal : createAnimal,
    initial,
  );
  // Sperrt Speichern, solange die Fotos im Browser umgewandelt werden. Ohne das
  // tippt jemand auf Speichern und schickt eine halbe Auswahl ab.
  const [photos, setPhotos] = useState<string[]>([]);
  const [fotosBusy, setFotosBusy] = useState(false);
  const feld = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [previewFacts, setPreviewFacts] = useState<[string, string][]>(animal ? publicAnimalFacts(animal, animal.profile) : []);
  const [previewStatus, setPreviewStatus] = useState(animal?.status ?? "vermittelbar");
  const [draft, setDraft] = useState({ name: animal?.name ?? "", breed: animal?.breed ?? "", description: animal?.description ?? "", valid: Boolean(animal) });
  function updatePreview() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const parsed = parseAnimal(data);
    if (parsed.success) { setPreviewFacts(publicAnimalFacts({ ...parsed.data, birthYear: parsed.data.birthYear ?? null, breed: parsed.data.breed ?? null, size: parsed.data.size ?? null }, profileFromForm(data))); setPreviewStatus(parsed.data.status); }
    else {
      const species = (["hund", "katze", "kleintier", "vogel", "sonstiges"] as const).find(value => value === data.get("species"));
      setPreviewFacts([["Art", species ? SPECIES_LABELS[species] : "Unbekannt"], ["Geboren", String(data.get("birthYear") ?? "") || "Unbekannt"]]);
    }
    setDraft({ name: String(data.get("name") ?? ""), breed: String(data.get("breed") ?? ""), description: String(data.get("description") ?? ""), valid: parseAnimal(data).success });
  }
  function focusField(name: string) {
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`);
    field?.focus();
    field?.scrollIntoView({ block: "center", behavior: "auto" });
  }

  return (
    <form ref={formRef} action={formAction} onChange={updatePreview} aria-label={animal ? "Tier bearbeiten" : "Tier anlegen"} className="space-y-5">
      <nav aria-label="Tierprofil-Fortschritt" className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 ring-1 ring-brand-100">
        <button type="button" onClick={() => focusField("name")} className="min-h-11 rounded-full border px-4">1 · Basisdaten {animalSchema.shape.name.safeParse(draft.name).success ? "✓" : ""}</button>
        <button type="button" onClick={() => focusField("description")} className="min-h-11 rounded-full border px-4">2 · Beschreibung {animalSchema.shape.description.safeParse(draft.description).success ? "✓" : ""}</button>
        <a href="#animal-preview" onClick={() => { const preview = formRef.current?.querySelector<HTMLDetailsElement>("#animal-preview"); if (preview) { preview.open = true; preview.querySelector("summary")?.focus(); } }} className="inline-flex min-h-11 items-center rounded-full border px-4">3 · Vorschau {draft.valid ? "✓" : ""}</a>
      </nav>
      {animal ? <><input type="hidden" name="id" value={animal.id} /><input type="hidden" name="revision" value={animal.revision} /></> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label="Name"
          required
          defaultValue={animal?.name}
          error={feld.name}
        />
        <ChoiceField
          name="species"
          label="Art"
          defaultValue={animal?.species ?? "hund"}
          options={ARTEN}
          error={feld.species}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <ChoiceField
          name="sex"
          label="Geschlecht"
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
        <ChoiceField
          name="status"
          label="Status"
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

      <details className="rounded-2xl border p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">Weitere Angaben</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.entries(profileLabels).map(([key, label]) => <TextField key={key} name={`profile.${key}`} label={label} defaultValue={animal?.profile[key as keyof typeof profileLabels] ?? ""} />)}
          {Object.entries(matchingOptions).map(([key, options]) => <SelectField key={key} name={`profile.${key}`} label={{ housing: "Wohnumgebung", experience: "Benötigte Erfahrung", activity: "Aktivitätsbedarf" }[key as keyof typeof matchingOptions]} defaultValue={animal?.profile[key as keyof typeof matchingOptions] ?? ""} options={options.map(([value, label]) => ({ value, label }))} />)}
        </div>
      </details>
      <PhotoInput
        label={`Fotos hochladen${animal ? " (zusätzlich)" : ""}`}
        hint="Mehrere Fotos auf einmal möglich, höchstens 8. Große Smartphonefotos werden vor dem Absenden automatisch verkleinert."
        error={feld.photos}
        onBusyChange={setFotosBusy}
        onPreviewChange={setPhotos}
      />

      <CheckboxField
        name="featured"
        label="Auf der Startseite zeigen"
        defaultChecked={animal?.featured}
      />

      <details id="animal-preview" className="rounded-2xl border bg-white p-5">
        <summary className="min-h-11 cursor-pointer font-semibold">Steckbriefvorschau</summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {(coverImage || photos[0]) ? <img src={coverImage || photos[0]} alt={coverImage ? "Aktuelles Titelbild" : "Vorschau des neuen Titelbildes"} className="mt-4 max-h-64 w-full rounded-xl object-cover" /> : null}
        <h2 className="mt-4 font-display text-2xl">{draft.name || "Neues Tier"}</h2>
        <p className="mt-2 text-sm font-semibold">{STATUS_LABELS[previewStatus]}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">{previewFacts.map(([label,value]) => <div key={label}><dt className="text-sm text-stone-500">{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="mt-3 whitespace-pre-line">{draft.description}</p>
        <p className="mt-4 text-sm text-ink/60">Vorschau der Eingaben. Veröffentlicht wird erst nach dem Speichern.</p>
      </details>
      {/* Genau ein role="alert" pro Formular, siehe Kommentar in fields.tsx */}
      <FormAlert state={state} />

      <button
        type="submit"
        disabled={pending || fotosBusy}
        className="animal-save sticky bottom-3 z-10 min-h-11 rounded-full bg-brand-800 px-7 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
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
