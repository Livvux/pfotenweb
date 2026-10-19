import { ProfileForm } from "@/components/admin/profile-form";
import { requireAdmin } from "@/lib/auth";
import { ownAccount } from "@/lib/account";
import { CodeFlow, PasswordConfirmation, PasskeySettings, FirstPasswordForm } from "@/components/security-forms";
import { EigenesPasswortForm } from "@/components/admin/team-forms";
export default async function AccountPage() {
  const actor = await requireAdmin();
  const account = await ownAccount(actor.id);
  return <div className="max-w-3xl space-y-8"><h1 className="font-display text-3xl">Konto und Sicherheit</h1><p>Angemeldet als {account.user.username}. Persönliche Sicherheitsdaten sind nur für diesen Zugang sichtbar.</p>
    <section className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">Internes Profil</h2><ProfileForm profile={account.user}/></section>
    <section className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">Zugang frisch bestätigen</h2><p className="text-sm">Eine Bestätigung gilt 15 Minuten für Sicherheitsaktionen. Ohne Passwort ist ein frischer Code an die bestätigte persönliche Adresse erforderlich.</p>{account.hasPassword && <PasswordConfirmation/>}<CodeFlow kind="reauth"/></section>
    <section className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">Persönliche E-Mail-Adresse</h2><p>{account.user.recoveryEmailVerifiedAt ? `Bestätigt: ${account.user.recoveryEmail}` : "Noch keine persönliche Adresse bestätigt. E-Mail-Code, Login-Link und Wiederherstellung bleiben bis dahin gesperrt."}</p><CodeFlow kind="email"/></section>
    <section className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">Passkeys</h2><PasskeySettings keys={account.keys}/></section>
    <section className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-stone-200"><h2 className="text-xl font-semibold">{account.hasPassword ? "Passwort ändern" : "Freiwilliges erstes Passwort"}</h2>{account.hasPassword ? <EigenesPasswortForm/> : <FirstPasswordForm/>}</section>
  </div>;
}
