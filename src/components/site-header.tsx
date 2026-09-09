import Link from "next/link";
import { BrandMark } from "./brand-mark";

const nav = [
  { href: "/tiere", label: "Tiere" },
  { href: "/aktuelles", label: "Aktuelles" },
  { href: "/verein", label: "Verein" },
  { href: "/kontakt", label: "Kontakt" },
];

/**
 * Die Wortmarke wird an einem Punkt geteilt, damit der zweite Teil in der
 * Akzentfarbe stehen kann. Vereine ohne Punkt im Kurznamen bekommen einfach
 * den ganzen Namen, kein Fallback-Basteln.
 */
function Wordmark({ shortName }: { shortName: string }) {
  const dot = shortName.indexOf(".");
  if (dot < 1 || dot === shortName.length - 1) return <span>{shortName}</span>;
  return (
    <span>
      {shortName.slice(0, dot)}
      <span className="text-accent-600">.</span>
      {shortName.slice(dot + 1)}
    </span>
  );
}

export function SiteHeader({
  shortName,
  logoUrl,
}: {
  shortName: string;
  logoUrl: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-base font-semibold tracking-tight text-brand-900"
        >
          <BrandMark logoUrl={logoUrl} />
          <Wordmark shortName={shortName} />
        </Link>

        <nav
          aria-label="Hauptnavigation"
          className="hidden items-center gap-1 md:flex"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-brand-50 hover:text-brand-900"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/tiere"
            className="ml-3 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Ein Zuhause schenken
          </Link>
        </nav>

        {/* Mobiles Menü ohne JavaScript über details/summary */}
        <details className="relative md:hidden">
          <summary
            aria-label="Menü öffnen"
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full transition hover:bg-brand-50 [&::-webkit-details-marker]:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <div className="absolute right-0 top-12 w-56 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl shadow-brand-950/10">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-brand-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/tiere"
              className="mt-1 block rounded-xl bg-brand-800 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Ein Zuhause schenken
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
