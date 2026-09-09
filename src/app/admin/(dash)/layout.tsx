import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { TenantTheme } from "@/components/tenant-theme";
import { getSettings } from "@/lib/tenant";

/**
 * nurOwner: die Seite selbst und ihre Aktionen pruefen die Rolle ohnehin. Das
 * Ausblenden hier ist keine Absicherung, sondern Freundlichkeit: ein Menuepunkt,
 * der immer auf eine Absage fuehrt, gehoert nicht ins Menue.
 */
const nav = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/tiere", label: "Tiere" },
  { href: "/admin/aktuelles", label: "Aktuelles" },
  { href: "/admin/anfragen", label: "Anfragen" },
  { href: "/admin/verein", label: "Verein", nurOwner: true },
  { href: "/admin/daten", label: "Datenexport", nurOwner: true },
  { href: "/admin/team", label: "Zugänge", nurOwner: true },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();
  const settings = await getSettings(user.scope.tenantId);
  const sichtbar = nav.filter((item) => !item.nurOwner || user.role === "owner");

  return (
    <div className="min-h-screen bg-paper">
      <TenantTheme />
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-serif text-lg text-stone-900"
          >
            <BrandMark
              logoUrl={settings?.logoUrl ?? null}
              className="h-7 w-7"
              fallbackClassName="text-brand-800"
            />
            {settings?.shortName ?? "Verwaltung"}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {sichtbar.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/*
           * Mobiles Menue ohne JavaScript ueber details/summary, dieselbe
           * Loesung wie im oeffentlichen Header. Mit fuenf und spaeter sieben
           * Eintraegen wird die umbrechende Zeile auf dem Handy sonst zwei
           * Zeilen hoch und die Treffflaechen liegen zu eng beieinander.
           */}
          <details className="relative ml-auto md:hidden">
            <summary
              aria-label="Menü öffnen"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg transition hover:bg-stone-100 [&::-webkit-details-marker]:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 z-10 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-950/10">
              {sichtbar.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-stone-100"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          <div className="flex items-center gap-4 text-sm md:ml-auto">
            {/*
             * Genau einmal im Dokument. Zweimal (mobil im Menue, gross in der
             * Kopfzeile) waere zwar unsichtbar redundant, bricht aber jeden
             * Textselektor in den E2E-Tests.
             */}
            <span className="text-stone-500">Angemeldet: {user.username}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-700 transition hover:bg-stone-100"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
