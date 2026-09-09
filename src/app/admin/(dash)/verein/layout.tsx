import Link from "next/link";
import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth";

/*
 * Die Vereinsdaten sind rund 25 Felder. In einem Formular waeren sie eine Wand,
 * und ein Validierungsfehler im Impressum wuerde die Aenderung am Hero-Text mit
 * verwerfen. Sechs kleine Formulare speichern unabhaengig voneinander.
 */
const reiter = [
  { href: "/admin/verein", label: "Verein" },
  { href: "/admin/verein/kontakt", label: "Kontakt" },
  { href: "/admin/verein/startseite", label: "Startseite" },
  { href: "/admin/verein/ueber-uns", label: "Über uns" },
  { href: "/admin/verein/impressum", label: "Impressum" },
  { href: "/admin/verein/erscheinungsbild", label: "Erscheinungsbild" },
];

export default async function VereinLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireOwner();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Vereinsdaten
      </h1>
      <p className="mt-2 text-sm text-ink/50">
        Diese Angaben erscheinen auf Ihrer Webseite, im Impressum und in der
        Fußzeile.
      </p>
      <nav
        aria-label="Bereiche der Vereinsdaten"
        className="mt-6 flex flex-wrap gap-1 border-b border-stone-200 pb-3"
      >
        {reiter.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
