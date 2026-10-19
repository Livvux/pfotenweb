import { an, parseAnrede } from "@/lib/anrede";
import type { Metadata } from "next";
import {
  addressLines,
  requireTenantWithSettings,
  type TenantSettings,
} from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await requireTenantWithSettings();
  return {
    title: "Datenschutzerklärung",
    description: `Informationen zur Verarbeitung personenbezogener Daten auf der Website von ${settings.orgName}.`,
  };
}

/*
 * Nur Abschnitt 1 ist vereinsspezifisch, der Rest beschreibt die immer gleiche
 * technische Verarbeitung dieser Software. Die vollstaendig editierbare
 * Erklaerung kommt mit dem Einstellungsbereich.
 */
const buildSections = (settings: TenantSettings) => [
  {
    title: "1. Verantwortliche Stelle",
    body: `Verantwortlich für die Datenverarbeitung auf dieser Website ist ${[
      settings.orgName,
      ...addressLines(settings),
      settings.publicEmail ? `E-Mail: ${settings.publicEmail}` : null,
    ]
      .filter(Boolean)
      .join(", ")}.`,
  },
  {
    title: "2. Erreichbarkeit per Kontaktformular",
    body: an(parseAnrede(settings.visitorAddress), "Wenn Sie uns über das Kontaktformular eine Anfrage senden, verarbeiten wir Ihre Angaben (Name, E-Mail-Adresse und Nachricht) ausschließlich zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO. Die Daten werden gelöscht, sobald sie für den Zweck nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.", "Wenn du uns über das Kontaktformular eine Anfrage sendest, verarbeiten wir deine Angaben (Name, E-Mail-Adresse und Nachricht) ausschließlich zur Bearbeitung deiner Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO. Die Daten werden gelöscht, sobald sie für den Zweck nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen."),
  },
  {
    title: "3. Hosting und Server-Logfiles",
    body: "Beim Aufruf dieser Website erhebt unser Hoster automatisch Zugriffsdaten (aufgerufene Seite, Zeitpunkt, übertragene Datenmenge, Browsertyp, IP-Adresse). Diese Logfiles werden zur Sicherstellung des technischen Betriebs benötigt und regelmäßig gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.",
  },
  {
    title: "4. Cookies",
    body: "Diese Website verwendet technisch notwendige Cookies nur für den geschlossenen Vereinsbereich (Anmeldung der Verwaltung). Die Software setzt keine Analyse- oder Werbecookies. Eine externe Standortkarte wird erst nach Klick geladen.",
  },
  {
    title: an(parseAnrede(settings.visitorAddress), "5. Ihre Rechte", "5. Deine Rechte"),
    body: an(parseAnrede(settings.visitorAddress), "Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch (Art. 21). Zudem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren.", "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch (Art. 21). Zudem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren."),
  },
];

export default async function DatenschutzPage() {
  const { settings } = await requireTenantWithSettings();
  const sections = buildSections(settings);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-900">
        Datenschutzerklärung
      </h1>
      <div className="mt-8 space-y-8 leading-relaxed text-ink/80">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-semibold text-brand-900">{s.title}</h2>
            <p className="mt-2">{s.body}</p>
          </section>
        ))}
        {settings.location?.enabled ? <section><h2 className="font-semibold text-brand-900">Standortkarte</h2><p className="mt-2">Die Karte auf der Kontaktseite wird erst nach Klick von OpenStreetMap geladen. Dabei werden die IP-Adresse und technische Browserdaten an den Kartenanbieter übertragen. Ohne Laden der Karte bleiben Besuchsadresse und Navigationslinks nutzbar. <a className="underline" href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">Datenschutzhinweise der OpenStreetMap Foundation</a></p></section> : null}
        <p className="text-sm text-ink/50">Stand: Oktober 2026</p>
      </div>
    </main>
  );
}
