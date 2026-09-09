import type { Metadata } from "next";
import { addressLines, requireTenantWithSettings } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Impressum",
    description: `Impressum und Anbieterkennzeichnung von ${settings.orgName}.`,
  };
}

export default async function ImpressumPage() {
  const { settings } = await requireTenantWithSettings();
  const register = [settings.registerCourt, settings.registerNumber]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-900">
        Impressum
      </h1>

      <div className="mt-8 space-y-8 leading-relaxed text-ink/80">
        <section>
          <h2 className="font-semibold text-brand-900">
            Angaben gemäß Paragraf 5 TMG
          </h2>
          <address className="mt-2 not-italic">
            {settings.orgName}
            {addressLines(settings).map((line) => (
              <span key={line}>
                <br />
                {line}
              </span>
            ))}
          </address>
        </section>

        {settings.representedBy && (
          <section>
            <h2 className="font-semibold text-brand-900">Vertreten durch</h2>
            <p className="mt-2">{settings.representedBy}</p>
          </section>
        )}

        {(settings.phone || settings.publicEmail) && (
          <section>
            <h2 className="font-semibold text-brand-900">Kontakt</h2>
            <p className="mt-2">
              {settings.phone && <>Telefon: {settings.phone}</>}
              {settings.phone && settings.publicEmail && <br />}
              {settings.publicEmail && <>E-Mail: {settings.publicEmail}</>}
            </p>
          </section>
        )}

        {(register || settings.taxNote) && (
          <section>
            <h2 className="font-semibold text-brand-900">
              Registereintrag und Steuern
            </h2>
            <p className="mt-2">
              {register && <>Eintragung im Vereinsregister: {register}. </>}
              {settings.taxNote}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
