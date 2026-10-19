/*
 * Anrede je Verein: "sie" oder "du", getrennt fuer Besucher der Website
 * (visitorAddress) und fuer das Vereinsteam in der Verwaltung (adminAddress).
 * Ohne Laufzeitabhaengigkeiten, damit Server und Browser dieselbe Datei nutzen.
 *
 * Texte stehen in beiden Fassungen ausgeschrieben, keine automatische
 * Umformung: "Prüfen Sie" wird "Prüfe", nicht "Prüfen du".
 */

export const ANREDEN = ["sie", "du"] as const;
export type Anrede = (typeof ANREDEN)[number];

/** Alles ausser "du" ist Sie: die Voreinstellung und der sichere Rueckfall. */
export function parseAnrede(value: unknown): Anrede {
  return value === "du" ? "du" : "sie";
}

/** Waehlt die passende Fassung: `an(anrede, "Prüfen Sie", "Prüfe")`. */
export function an<T>(anrede: Anrede, sie: T, du: T): T {
  return anrede === "du" ? du : sie;
}
