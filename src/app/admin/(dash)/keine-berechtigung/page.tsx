import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listOwners } from "@/lib/users";

/**
 * Die Seite, auf der requireOwner() landet.
 *
 * Bewusst eine erklaerende Seite statt notFound(): "Seite nicht gefunden" ist
 * fuer die Zielgruppe grausam, wenn der Punkt eben noch im Menue stand. Hier
 * steht stattdessen, wer weiterhelfen kann.
 */
export default async function KeineBerechtigungPage() {
  const eigen = await requireAdmin();
  // listOwners statt alle Konten laden und filtern: die Seite nennt nur die
  // Verantwortlichen.
  const verantwortliche = (await listOwners(eigen.scope)).map((u) => u.username);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Diese Seite ist für Verantwortliche
      </h1>
      <p className="mt-3 text-ink/70">
        Ihr Zugang darf Tiere, Aktuelles und Anfragen pflegen. Vereinsdaten und
        Zugänge ändert, wer im Verein dafür verantwortlich ist.
      </p>
      {verantwortliche.length > 0 ? (
        <p className="mt-3 text-ink/70">
          Wenden Sie sich an: {verantwortliche.join(", ")}.
        </p>
      ) : null}
      <Link
        href="/admin"
        className="mt-6 inline-block rounded-full bg-brand-800 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
      >
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
