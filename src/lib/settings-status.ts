import type { TenantSettings } from "@/lib/tenant";

/**
 * Was ein Verein ausgefuellt haben sollte, bevor seine Seite oeffentlich geht.
 *
 * Eine Quelle fuer drei Verbraucher: die Uebersicht unter /admin/verein, der
 * Einrichtungshinweis auf /admin und spaeter die Freigabe des Knopfs
 * „Freischaltung beantragen“. Zwei getrennte Regelwerke wuerden zwangslaeufig
 * auseinanderlaufen.
 */
export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
  /** Pflicht heisst: ohne das geht die Seite nicht online. */
  required: boolean;
  /** Warum das gebraucht wird. Erscheint als Hilfstext neben dem Punkt. */
  why?: string;
};

function gefuellt(...werte: (string | null | undefined)[]): boolean {
  return werte.every((w) => typeof w === "string" && w.trim().length > 0);
}

export function settingsChecklist(
  settings: TenantSettings,
  counts: { animals: number },
): ChecklistItem[] {
  return [
    {
      key: "identitaet",
      label: "Vereinsname und Kurzname",
      done: gefuellt(settings.orgName, settings.shortName),
      href: "/admin/verein",
      required: true,
    },
    {
      key: "anschrift",
      label: "Anschrift eintragen",
      done: gefuellt(settings.street, settings.postalCode, settings.city),
      href: "/admin/verein/kontakt",
      required: true,
      why: "Für das Impressum vorgeschrieben.",
    },
    {
      key: "erreichbar",
      label: "Telefon oder E-Mail angeben",
      done: gefuellt(settings.phone) || gefuellt(settings.publicEmail),
      href: "/admin/verein/kontakt",
      required: true,
      why: "Besucher müssen Sie erreichen können.",
    },
    {
      key: "vertretung",
      label: "Vertretungsberechtigte Person nennen",
      done: gefuellt(settings.representedBy),
      href: "/admin/verein/impressum",
      required: true,
      why: "Gehört nach Paragraf 5 TMG ins Impressum.",
    },
    {
      key: "register",
      label: "Registergericht und Registernummer",
      done: gefuellt(settings.registerCourt, settings.registerNumber),
      href: "/admin/verein/impressum",
      required: false,
      why: "Nur für eingetragene Vereine.",
    },
    {
      key: "startseite",
      label: "Überschrift der Startseite",
      done: gefuellt(settings.heroHeadline),
      href: "/admin/verein/startseite",
      required: true,
    },
    {
      key: "ueberuns",
      label: "Den Verein vorstellen",
      done: gefuellt(settings.aboutIntro),
      href: "/admin/verein/ueber-uns",
      required: false,
    },
    {
      key: "tiere",
      label: "Mindestens ein Tier anlegen",
      done: counts.animals > 0,
      href: "/admin/tiere/neu",
      required: true,
      why: "Eine Vermittlungsseite ohne Tiere hat keinen Zweck.",
    },
  ];
}

/** Alle Pflichtpunkte erledigt. Voraussetzung fuer die Freischaltung. */
export function isReadyForReview(list: ChecklistItem[]): boolean {
  return list.every((i) => i.done || !i.required);
}

/** Was noch fehlt, fuer den Hinweistext am deaktivierten Knopf. */
export function missingRequired(list: ChecklistItem[]): ChecklistItem[] {
  return list.filter((i) => i.required && !i.done);
}
