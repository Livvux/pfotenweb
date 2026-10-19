import Link from "next/link";
import { credentialHash } from "@/lib/auth-users";
import { requireOwner } from "@/lib/auth";
import { getAdminAnrede } from "@/lib/anrede-server";
import { an } from "@/lib/anrede";
export default async function DataPage() {
  const user = await requireOwner();
  const hasPassword = Boolean(await credentialHash(user.id));
  const address = await getAdminAnrede();
  return <section className="max-w-2xl space-y-5"><h1 className="font-serif text-3xl">Daten mitnehmen</h1>
    <p>{an(address, "Laden Sie Vereinsdaten, Tiere, Bilder, Neuigkeiten und Kontaktanfragen mit Antwortverlauf für eine eigene Pfotenweb-Installation herunter. Teamzugänge richten Sie dort neu ein.", "Lade Vereinsdaten, Tiere, Bilder, Neuigkeiten und Kontaktanfragen mit Antwortverlauf für eine eigene Pfotenweb-Installation herunter. Teamzugänge richtest du dort neu ein.")}</p>
    <p>{an(address, "Das Archiv enthält personenbezogene Daten und gegebenenfalls die Bankverbindung für Spenden. Bewahren Sie es geschützt auf. Zugänge und Passwörter sind nicht enthalten.", "Das Archiv enthält personenbezogene Daten und gegebenenfalls die Bankverbindung für Spenden. Bewahre es geschützt auf. Zugänge und Passwörter sind nicht enthalten.")}</p>
    <form action="/api/export" method="post" className="space-y-4 rounded-xl bg-white p-6">{hasPassword ? <label className="block">{an(address, "Ihr aktuelles Passwort", "Dein aktuelles Passwort")}<input required type="password" name="password" autoComplete="current-password" maxLength={200} className="mt-2 block w-full rounded border p-3" /></label> : <p>Ohne Passwort ist eine Bestätigung per E-Mail-Code innerhalb der letzten 15 Minuten erforderlich. <Link className="underline" href="/admin/konto">Zugang unter Konto bestätigen</Link>.</p>}<button className="rounded bg-brand-800 px-5 py-3 text-white">Export herunterladen</button></form>
  </section>;
}
