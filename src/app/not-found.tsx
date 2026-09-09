import Link from "next/link";

/**
 * Die 404-Seite fuer alles: unbekannte Pfade, aber auch jedes notFound() aus
 * requireTenant(), requireActiveTenant() und requirePlatformHost(). Auf der
 * Plattform-Hauptdomain landet hier auch, wer eine Subdomain aufruft, die es
 * nicht gibt.
 *
 * Bewusst ohne getCurrentTenant(): Next rendert /_not-found beim Build vor,
 * dann gibt es weder Request-Host noch zwingend eine erreichbare Datenbank.
 * Aus demselben Grund steht hier kein Vereinsname und kein Logo.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <p className="font-display text-6xl font-semibold text-stone-300">
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
          Diese Seite gibt es nicht
        </h1>
        <p className="mt-3 text-stone-600">
          Vielleicht wurde sie verschoben oder die Adresse hat einen Tippfehler.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 transition hover:bg-stone-100"
        >
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
