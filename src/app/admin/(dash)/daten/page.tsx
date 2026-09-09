import { requireOwner } from "@/lib/auth";
export default async function DataPage() {
  await requireOwner();
  return <section className="max-w-2xl space-y-5"><h1 className="font-serif text-3xl">Daten mitnehmen</h1><p>Laden Sie Vereinsdaten, Tiere, Bilder, Neuigkeiten und Kontaktanfragen für eine eigene Pfotenweb-Installation herunter. Teamzugänge richten Sie dort neu ein.</p><p>Das Archiv enthält personenbezogene Daten. Bewahren Sie es geschützt auf. Zahlungsdaten und Passwörter sind nicht enthalten.</p><form action="/api/export" method="post" className="space-y-4 rounded-xl bg-white p-6"><label className="block">Ihr aktuelles Passwort<input required type="password" name="password" autoComplete="current-password" maxLength={200} className="mt-2 block w-full rounded border p-3" /></label><button className="rounded bg-brand-800 px-5 py-3 text-white">Export herunterladen</button></form></section>;
}
