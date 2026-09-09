"use client";

import { useActionState } from "react";
import type { TenantSettings } from "@/lib/tenant";
import type { FormState } from "@/lib/form";
import {
  updateVereinIdentitaet,
  updateVereinImpressum,
  updateVereinKontakt,
} from "@/lib/actions/settings";
import { TextArea, TextField } from "./fields";
import { SaveBar } from "./save-bar";

const initial: FormState = {};

export function IdentitaetForm({ settings }: { settings: TenantSettings }) {
  const [state, action, pending] = useActionState(
    updateVereinIdentitaet,
    initial,
  );
  const feld = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <TextField
        name="orgName"
        label="Vollständiger Vereinsname"
        required
        defaultValue={settings.orgName}
        error={feld.orgName}
        hint="Wie im Vereinsregister, zum Beispiel Tierschutzverein Wiesengrund e.V."
      />
      <TextField
        name="shortName"
        label="Kurzname"
        required
        defaultValue={settings.shortName}
        error={feld.shortName}
        hint="Erscheint im Seitenkopf und in der Fußzeile. Kurz halten."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="legalForm"
          label="Rechtsform"
          defaultValue={settings.legalForm}
          error={feld.legalForm}
          placeholder="e.V."
        />
        <TextField
          name="foundedYear"
          label="Gegründet"
          type="number"
          defaultValue={settings.foundedYear}
          error={feld.foundedYear}
          placeholder="1987"
        />
      </div>
      <TextArea
        name="tagline"
        label="Kurzbeschreibung"
        rows={3}
        defaultValue={settings.tagline}
        error={feld.tagline}
        hint="Ein Satz über Ihren Verein. Steht in der Fußzeile und in Suchergebnissen."
      />
      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function KontaktForm({ settings }: { settings: TenantSettings }) {
  const [state, action, pending] = useActionState(updateVereinKontakt, initial);
  const feld = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <TextField
        name="street"
        label="Straße und Hausnummer"
        defaultValue={settings.street}
        error={feld.street}
      />
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <TextField
          name="postalCode"
          label="Postleitzahl"
          defaultValue={settings.postalCode}
          error={feld.postalCode}
        />
        <TextField
          name="city"
          label="Ort"
          defaultValue={settings.city}
          error={feld.city}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="phone"
          label="Telefon"
          type="tel"
          defaultValue={settings.phone}
          error={feld.phone}
        />
        <TextField
          name="publicEmail"
          label="E-Mail für Besucher"
          type="email"
          defaultValue={settings.publicEmail}
          error={feld.publicEmail}
          hint="Steht öffentlich auf der Seite."
        />
      </div>
      <TextArea
        name="openingHours"
        label="Besuchszeiten"
        rows={3}
        defaultValue={settings.openingHours}
        error={feld.openingHours}
        hint="Zum Beispiel: Dienstag bis Sonntag, 10 bis 16 Uhr, nach Vereinbarung."
      />
      <TextField
        name="contactNotifyEmail"
        label="Benachrichtigung bei neuen Anfragen an"
        type="email"
        defaultValue={settings.contactNotifyEmail}
        error={feld.contactNotifyEmail}
        hint="Wohin die E-Mail geht, wenn jemand das Kontaktformular ausfüllt. Anfragen stehen immer auch unter „Anfragen“."
      />
      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function ImpressumForm({ settings }: { settings: TenantSettings }) {
  const [state, action, pending] = useActionState(
    updateVereinImpressum,
    initial,
  );
  const feld = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <TextArea
        name="representedBy"
        label="Vertreten durch"
        rows={2}
        defaultValue={settings.representedBy}
        error={feld.representedBy}
        hint="Zum Beispiel: Vorstand Maria Musterfrau, Stefan Beispiel."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="registerCourt"
          label="Registergericht"
          defaultValue={settings.registerCourt}
          error={feld.registerCourt}
          placeholder="Amtsgericht Musterstadt"
        />
        <TextField
          name="registerNumber"
          label="Registernummer"
          defaultValue={settings.registerNumber}
          error={feld.registerNumber}
          placeholder="VR 12345"
        />
      </div>
      <TextArea
        name="taxNote"
        label="Hinweis zur Gemeinnützigkeit"
        rows={3}
        defaultValue={settings.taxNote}
        error={feld.taxNote}
      />
      <SaveBar state={state} pending={pending} />
    </form>
  );
}
