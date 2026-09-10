import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { addressLines, type TenantSettings } from "@/lib/tenant";

export function SiteFooter({ settings }: { settings: TenantSettings }) {
  const address = addressLines(settings);

  return (
    <footer className="mt-auto bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark
              logoUrl={settings.logoUrl}
              fallbackClassName="text-accent-300"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              {settings.shortName}
            </span>
          </div>
          {settings.tagline && (
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-brand-200">
              {settings.tagline}
            </p>
          )}
        </div>
        <nav aria-label="Footer-Navigation" className="text-sm">
          <h3 className="font-semibold text-white">Seiten</h3>
          <ul className="mt-3 space-y-2">
            {[
              { href: "/tiere", label: "Tiere vermitteln" },
              { href: "/aktuelles", label: "Aktuelles" },
              { href: "/verein", label: "Über den Verein" },
              { href: "/kontakt", label: "Kontakt & Anfahrt" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <h3 className="font-semibold text-white">Kontakt</h3>
          <address className="mt-3 space-y-2 not-italic text-brand-200">
            {address.length > 0 && <p>{address.join(" · ")}</p>}
            {settings.phone && <p>Telefon: {settings.phone}</p>}
            {settings.publicEmail && <p>E-Mail: {settings.publicEmail}</p>}
          </address>
        </div>
      </div>
      <div className="border-t border-brand-800/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-brand-300">
          <p>
            © {new Date().getFullYear()} {settings.orgName}
          </p>
          <a href="https://pfotenweb.de" className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Mit Pfotenweb erstellt
          </a>
          <div className="flex flex-wrap gap-5">
            <Link href="/impressum" className="transition hover:text-white">
              Impressum
            </Link>
            <Link href="/datenschutz" className="transition hover:text-white">
              Datenschutz
            </Link>
            <Link href="/admin/login" className="transition hover:text-white">
              Vereinslogin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
