"use client";
import { useActionState, useEffect, useId, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  requestLoginCode, confirmLoginCode, requestMagicLogin, requestPasswordReset,
  confirmMagicLogin, resetPassword, acceptInvitation, confirmPassword,
  requestReauthenticationCode, confirmReauthenticationCode,
  requestEmailConfirmation, confirmEmail, inviteUser, setFirstPassword, type SecurityState,
} from "@/lib/actions/security";
import { authClient } from "@/lib/auth-client";
import { areas, areaLabels } from "@/lib/roles";
import { FormAlert, TextField } from "./admin/fields";
function SecurityTextField(props: ComponentProps<typeof TextField>) {
  const id = useId();
  return <TextField {...props} id={props.id ?? id}/>;
}
const empty: SecurityState = {};
function Result({ state }: { state: SecurityState }) {
  return <><FormAlert state={state}/>{state.notice && <p role="status" className="text-sm">{state.notice}</p>}{state.success && <p role="status" className="text-sm">Bestätigt.</p>}</>;
}
export function CodeFlow({ kind }: { kind: "login" | "reauth" | "email" }) {
  const actions = { login: [requestLoginCode, confirmLoginCode], reauth: [requestReauthenticationCode, confirmReauthenticationCode], email: [requestEmailConfirmation, confirmEmail] } as const;
  const [requested, request, sending] = useActionState(actions[kind][0], empty);
  const [confirmed, confirm, checking] = useActionState(actions[kind][1], empty);
  return <div className="space-y-4"><form action={request} className="space-y-3">
    {kind !== "reauth" && <SecurityTextField type="email" name="email" label={kind === "email" ? "Neue persönliche E-Mail-Adresse" : "Bestätigte persönliche E-Mail-Adresse"} required autoComplete="email"/>}
    <button className="admin-button" disabled={sending}>{sending ? "Wird angefordert …" : kind === "email" ? "Adresse bestätigen" : "Code anfordern"}</button><Result state={requested}/>
  </form>{requested.challengeId && !confirmed.success && <form action={confirm} className="space-y-3" aria-label="E-Mail-Code bestätigen"><input type="hidden" name="challengeId" value={requested.challengeId}/><SecurityTextField name="code" label="Sechsstelliger Code" required autoComplete="one-time-code"/><button className="admin-button admin-primary" disabled={checking}>{checking ? "Wird geprüft …" : "Code bestätigen"}</button><Result state={confirmed}/></form>}{confirmed.success && <Result state={confirmed}/>}</div>;
}
export function MailRequestForm({ mode }: { mode: "magic" | "reset" }) {
  const [state, action, pending] = useActionState(mode === "magic" ? requestMagicLogin : requestPasswordReset, empty);
  return <form action={action} className="space-y-3"><SecurityTextField name="email" type="email" label="Bestätigte persönliche E-Mail-Adresse" required autoComplete="email"/><button className="admin-button" disabled={pending}>{pending ? "Wird angefordert …" : mode === "magic" ? "Einmaligen Login-Link anfordern" : "Link zum Zurücksetzen anfordern"}</button><Result state={state}/></form>;
}
export function PasskeyLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <div className="space-y-2"><button type="button" className="admin-button" disabled={pending} onClick={() => start(async () => {
    try { const result = await authClient.signIn.passkey(); if (result.error) setError(result.error.message ?? "Passkey-Anmeldung nicht möglich."); else { router.push("/admin"); router.refresh(); } }
    catch { setError("Passkey-Anmeldung wurde abgebrochen oder ist hier nicht verfügbar."); }
  })}>{pending ? "Wird angemeldet …" : "Mit Passkey anmelden"}</button>{error && <p role="alert">{error}</p>}</div>;
}
export function SecurityLanding({ mode }: { mode: "magic" | "reset" | "invite" }) {
  const [token, setToken] = useState("");
  const [state, action, pending] = useActionState(mode === "magic" ? confirmMagicLogin : mode === "reset" ? resetPassword : acceptInvitation, empty);
  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
    const task = requestAnimationFrame(() => { setToken(value); history.replaceState(null, "", location.pathname + location.search); });
    return () => cancelAnimationFrame(task);
  }, []);
  return <form action={action} className="space-y-4">
    <input type="hidden" name={mode === "invite" ? "challengeId" : "token"} value={token}/>
    {!token && <p>Bitte den persönlichen Link aus der E-Mail öffnen. Der Link benötigt JavaScript, damit der geheime Teil nicht als Seitenadresse übertragen wird.</p>}
    {mode === "invite" && <SecurityTextField name="code" label="Sechsstelliger Code aus der Einladung" required autoComplete="one-time-code"/>}
    {mode !== "magic" && <SecurityTextField name="password" type="password" label={mode === "invite" ? "Erstes Passwort (freiwillig, mindestens 8 Zeichen)" : "Neues Passwort"} required={mode === "reset"} autoComplete="new-password"/>}
    <p className="text-sm">{mode === "invite" ? "Ohne Passwort funktioniert die Anmeldung mit persönlichem E-Mail-Code oder einem später eingerichteten Passkey." : "Der Link wird erst nach Bestätigung verwendet."}</p>
    <button disabled={pending || !token} className="admin-button admin-primary">{pending ? "Wird bestätigt …" : mode === "magic" ? "Anmeldung bestätigen" : mode === "reset" ? "Neues Passwort speichern" : "Einladung annehmen"}</button><Result state={state}/>
  </form>;
}
export function PasswordConfirmation() {
  const [state, action, pending] = useActionState(confirmPassword, empty);
  return <form action={action} className="space-y-3"><SecurityTextField name="password" type="password" label="Aktuelles Passwort zur Bestätigung" required autoComplete="current-password"/><button disabled={pending} className="admin-button">Passwort bestätigen</button><Result state={state}/></form>;
}
export function InvitationForm() {
  const [state, action, pending] = useActionState(inviteUser, empty);
  return <form action={action} className="space-y-3"><SecurityTextField name="username" label="Benutzername" required/><SecurityTextField name="email" type="email" label="Persönliche E-Mail-Adresse" required/><label className="grid gap-1">Rolle<select name="role" defaultValue="editor" className="rounded-lg border p-3"><option value="editor">Redaktion</option><option value="owner">Verantwortlich</option></select></label><fieldset className="space-y-2"><legend className="font-medium">Bereichsrechte für Redaktion</legend>{areas.map(area => <label key={area} className="flex gap-2"><input type="checkbox" name="permissions" value={area}/>{areaLabels[area]}</label>)}</fieldset><p className="text-sm">Neue Zugänge erhalten nur die ausdrücklich gewählten Bereiche. Verantwortliche haben Zugriff auf alle Bereiche.</p><button disabled={pending} className="admin-button admin-primary">Einladung verschicken</button><Result state={state}/></form>;
}
export function PasskeySettings({ keys }: { keys: { id: number; name: string | null }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function run(operation: () => Promise<{ error?: { message?: string } | null }>) {
    start(async () => { try { const result = await operation(); if (result.error) setError(result.error.message ?? "Bitte den Zugang frisch bestätigen."); else { setError(""); router.refresh(); } } catch { setError("Vorgang wurde abgebrochen oder ist nicht verfügbar."); } });
  }
  return <div className="space-y-3">{error && <p role="alert">{error}</p>}<ul>{keys.map(key => <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><span>{key.name || "Passkey"}</span><button type="button" disabled={pending} className="admin-button" onClick={() => { if (window.confirm("Diesen Passkey entfernen?")) run(() => authClient.passkey.deletePasskey({ id: String(key.id) })); }}>Entfernen</button></li>)}</ul><button type="button" disabled={pending} className="admin-button" onClick={() => run(() => authClient.passkey.addPasskey({}))}>Passkey hinzufügen</button></div>;
}

export function FirstPasswordForm() {
  const [state, action, pending] = useActionState(setFirstPassword, empty);
  return <form action={action} className="space-y-3"><SecurityTextField name="password" type="password" label="Erstes Passwort" required autoComplete="new-password"/><button disabled={pending} className="admin-button">Erstes Passwort speichern</button><Result state={state}/></form>;
}
