"use client";

import { an } from "@/lib/anrede";
import { useAnrede } from "@/components/anrede-provider";
import { useActionState } from "react";
import {
  changeOwnPassword,
  changeUserRole,
  createUser,
  deleteUser,
  resetUserPassword,
  updateUserAccess,
} from "@/lib/actions/users";
import type { FormState } from "@/lib/form";
// Aus roles.ts, NICHT aus users.ts: users.ts importiert @/db und wuerde den
// Postgres-Treiber in dieses Client-Bundle ziehen.
import { areas, areaLabels, ROLE_HINTS, ROLE_LABELS, ROLLEN, type TeamUser } from "@/lib/roles";
import { FormAlert, SelectField, TextField } from "./fields";
import { SaveBar } from "./save-bar";
import { ConfirmButton } from "./confirm-button";

const leer: FormState = {};

export function NeuerBenutzerForm() {
  const address = useAnrede();
  const [state, formAction, pending] = useActionState(createUser, leer);
  const feld = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="username"
          label="Benutzername"
          required
          autoComplete="off"
          error={feld.username}
          hint="Womit sich die Person anmeldet, zum Beispiel anna."
        />
        <TextField
          name="password"
          label="Passwort"
          type="password"
          required
          autoComplete="new-password"
          error={feld.password}
          hint={an(address, "Mindestens 8 Zeichen. Sagen Sie es der Person persönlich weiter.", "Mindestens 8 Zeichen. Sag es der Person persönlich weiter.")}
        />
      </div>
      <SelectField
        name="role"
        label="Rolle"
        required
        defaultValue="editor"
        options={ROLLEN.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        error={feld.role}
        hint={`${ROLE_LABELS.editor}: ${ROLE_HINTS.editor} ${ROLE_LABELS.owner}: ${ROLE_HINTS.owner}`}
      />
      <SaveBar
        state={state}
        pending={pending}
        label="Zugang anlegen"
        successText="Der Zugang wurde angelegt."
      />
    </form>
  );
}

/**
 * Eine Zeile der Zugangsliste.
 *
 * Jede Zeile haelt ihre eigenen Zustaende, damit eine Fehlermeldung dort steht,
 * wo sie hingehoert, und nicht oben ueber der ganzen Liste.
 */
export function TeamZeile({
  user,
  selbst,
  letzterOwner,
}: {
  user: TeamUser;
  selbst: boolean;
  letzterOwner: boolean;
}) {
  const address = useAnrede();
  const [rolleState, rolleAction] = useActionState(changeUserRole, leer);
  const [loeschState, loeschAction] = useActionState(deleteUser, leer);
  const [pwState, pwAction, pwPending] = useActionState(resetUserPassword, leer);
  const [accessState, accessAction, accessPending] = useActionState(updateUserAccess, leer);
  const pwFeld = pwState.fieldErrors ?? {};
  const meldung = rolleState.error ?? loeschState.error;

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {user.username}
            {selbst ? (
              <span className="ml-2 text-sm font-normal text-ink/50">{an(address, "(Sie)", "(du)")}</span>
            ) : null}
          </p>
          <p className="text-sm text-ink/50">{ROLE_HINTS[user.role]}</p>
        </div>

        {/* Rollenwechsel: zwei Submit-Knoepfe, kein Aufklappmenue. Der aktuelle
            Wert bleibt dadurch sichtbar. */}
        <form action={rolleAction} className="flex gap-2">
          <input type="hidden" name="userId" value={user.id} />
          {ROLLEN.map((r) => (
            <button
              key={r}
              type="submit"
              name="role"
              value={r}
              disabled={selbst}
              aria-pressed={user.role === r}
              className={
                user.role === r
                  ? "rounded-full bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-70"
                  : "rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:opacity-40"
              }
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </form>

        {selbst || letzterOwner ? (
          <p className="text-sm text-ink/40">
            {selbst
              ? "Eigener Zugang"
              : "Letzter verantwortlicher Zugang"}
          </p>
        ) : (
          <form action={loeschAction}>
            <input type="hidden" name="userId" value={user.id} />
            <ConfirmButton
              question={`Der Zugang „${user.username}“ wird gelöscht.`}
            />
          </form>
        )}
      </div>

      <div className="mt-3 empty:mt-0">
        <FormAlert state={{ error: meldung }} />
      </div>

      <form action={accessAction} className="mt-4 space-y-3">
        <input type="hidden" name="userId" value={user.id} />
        <fieldset disabled={selbst || accessPending} className="space-y-2">
          <legend className="text-sm font-medium">Zugriff und Bereiche</legend>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user.active} /> Zugang aktiv</label>
          {user.role === "editor" ? areas.map(area => <label key={area} className="flex gap-2 text-sm"><input type="checkbox" name="permissions" value={area} defaultChecked={user.permissions.includes(area)} /> {areaLabels[area]}</label>) : <p className="text-sm text-ink/60">Verantwortliche haben Zugriff auf alle Bereiche.</p>}
          <button type="submit" className="rounded-full border px-4 py-2 text-sm font-semibold">Zugriff speichern</button>
        </fieldset>
        <FormAlert state={accessState} />
        {accessState.success ? <p className="text-sm">Zugriff gespeichert. Bestehende Sitzungen wurden beendet.</p> : null}
      </form>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-stone-600">
          Passwort neu setzen
        </summary>
        <form action={pwAction} className="mt-3 max-w-sm space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <TextField
            name="password"
            id={`password-${user.id}`}
            label={`Neues Passwort für ${user.username}`}
            type="password"
            required
            autoComplete="new-password"
            error={pwFeld.password}
            hint="Mindestens 8 Zeichen. Alle Sitzungen dieser Person werden dabei beendet."
          />
          {pwState.error ? (
            <p className="text-sm font-medium text-red-700">{pwState.error}</p>
          ) : null}
          {pwState.success ? (
            <p className="text-sm font-medium text-brand-800">
              Das Passwort wurde gesetzt. Bitte der Person weitersagen.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pwPending}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
          >
            {pwPending ? "Speichert …" : "Passwort setzen"}
          </button>
        </form>
      </details>
    </li>
  );
}

export function EigenesPasswortForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, leer);
  const feld = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-sm space-y-5">
      <TextField
        name="current"
        label="Aktuelles Passwort"
        type="password"
        required
        autoComplete="current-password"
        error={feld.current}
      />
      <TextField
        name="password"
        id="neues-passwort"
        label="Neues Passwort"
        type="password"
        required
        autoComplete="new-password"
        error={feld.password}
        hint="Mindestens 8 Zeichen."
      />
      <SaveBar
        state={state}
        pending={pending}
        label="Passwort ändern"
        successText="Das Passwort wurde geändert."
      />
    </form>
  );
}
