import type { ReactNode } from "react";

/**
 * Ein Abschnitt der Vereinsdaten: Ueberschrift plus Karte.
 *
 * Die fuenf Unterseiten unter /admin/verein unterschieden sich nur in dieser
 * Ueberschrift und im Formular. Sechs Abschriften derselben sechs
 * Tailwind-Klassen laufen frueher oder spaeter auseinander.
 */
export function VereinAbschnitt({
  titel,
  children,
}: {
  titel: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-semibold tracking-tight text-ink">
        {titel}
      </h2>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        {children}
      </div>
    </section>
  );
}
