import type { AnimalProfile } from "./animal-profile-fields";

export const matchingOptions = {
  housing: [["", "Unbekannt"], ["wohnung-oder-haus", "Wohnung oder Haus möglich"], ["haus", "Haus erforderlich"], ["haus-mit-garten", "Haus mit Garten erforderlich"]],
  experience: [["", "Unbekannt"], ["anfaenger", "Auch für Anfänger"], ["erfahren", "Erfahrung erforderlich"]],
  activity: [["", "Unbekannt"], ["ruhig", "Ruhig"], ["mittel", "Mittel"], ["aktiv", "Aktiv"]],
} satisfies Record<string, [string, string][]>;
export function matchingValueLabel(field: keyof typeof matchingOptions, value: string): string {
  return matchingOptions[field].find(([key]) => key === value)?.[1] ?? "Unbekannt";
}
export type MatchPreferences = { housing: "wohnung" | "haus" | "haus-mit-garten" | ""; children: boolean; dogs: boolean; cats: boolean; experience: "anfaenger" | "erfahren" | ""; activity: "ruhig" | "mittel" | "aktiv" | "" };
export type MatchResult = { reasons: string[]; questions: string[]; conflicts: string[] };

/** Only explicit structured values or unqualified yes/no statements are evidence. */
export function animalMatch(status: string, profile: AnimalProfile, preferences: MatchPreferences): MatchResult {
  const result: MatchResult = { reasons: [], questions: [], conflicts: [] };
  if (status !== "vermittelbar") result.conflicts.push("Aktuell nicht als vermittelbar geführt.");
  for (const field of ["dogs", "cats", "children"] as const) {
    if (!preferences[field]) continue;
    const label = { dogs: "Hunden", cats: "Katzen", children: "Kindern" }[field];
    const value = profile[field]?.trim().toLocaleLowerCase("de");
    if (value && ["ja", "verträglich", `verträglich mit ${label.toLocaleLowerCase("de")}`].includes(value.replace(/\.$/u, ""))) result.reasons.push(`Verträglichkeit mit ${label} ausdrücklich angegeben.`);
    else if (value && /^(nein|nicht verträglich|unverträglich)\.?$/u.test(value)) result.conflicts.push(`Keine Verträglichkeit mit ${label} angegeben.`);
    else result.questions.push(`Zusammenleben mit ${label} klären${profile[field] ? `: „${profile[field]}“` : "."}`);
  }
  if (preferences.housing) {
    if (!profile.housing || profile.housing === "unbekannt") result.questions.push("Wohnumgebung mit dem Verein klären.");
    else if (profile.housing === "wohnung-oder-haus" || profile.housing === preferences.housing || (profile.housing === "haus" && preferences.housing === "haus-mit-garten")) result.reasons.push("Die angegebene Wohnumgebung erfüllt die eingetragenen Voraussetzungen.");
    else result.conflicts.push(`Benötigte Wohnumgebung: ${matchingValueLabel("housing", profile.housing)}.`);
  }
  if (preferences.experience) {
    if (!profile.experience || profile.experience === "unbekannt") result.questions.push("Benötigte Erfahrung mit dem Verein klären.");
    else if (profile.experience === "anfaenger" || preferences.experience === "erfahren") result.reasons.push("Die eingetragene Voraussetzung zur Erfahrung ist erfüllt.");
    else result.conflicts.push("Für dieses Tier ist Erfahrung erforderlich.");
  }
  if (preferences.activity) {
    const levels: Record<string, number> = { ruhig: 1, mittel: 2, aktiv: 3 };
    if (!profile.activity || !levels[profile.activity]) result.questions.push("Aktivitätsbedarf mit dem Verein klären.");
    else if (levels[preferences.activity] >= levels[profile.activity]) result.reasons.push(`Eingetragener Aktivitätsbedarf: ${matchingValueLabel("activity", profile.activity)}.`);
    else result.conflicts.push(`Höherer Aktivitätsbedarf: ${matchingValueLabel("activity", profile.activity)}.`);
  }
  return result;
}
