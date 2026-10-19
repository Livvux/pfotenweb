import type { Animal } from "./animals";
import { SPECIES_LABELS, ageText } from "./animal-display";
import { profileLabels, type AnimalProfile } from "./animal-profile-fields";
import { matchingValueLabel } from "./animal-matching";
export function publicAnimalFacts(animal: Pick<Animal, "species" | "birthYear" | "breed" | "size" | "sex">, profile: AnimalProfile): [string, string][] {
  const age = profile.age || ageText(animal);
  const breed = animal.breed;
  const size = animal.size;
  return [
    ["Art", SPECIES_LABELS[animal.species]],
    ["Geboren", profile.birthDate || (animal.birthYear ? String(animal.birthYear) : "unbekannt")],
    ...(age ? [[profile.age ? "Übernommene Altersangabe" : "Alter", age] as [string, string]] : []),
    ...(breed ? ([["Rasse", breed]] as [string, string][]) : []),
    [
      "Geschlecht",
      animal.sex === "m" ? "männlich" : animal.sex === "w" ? "weiblich" : "unbekannt",
    ],
    ...(size ? ([["Größe", size]] as [string, string][]) : []),
    ...(["location", "dogs", "cats", "children", "health", "character"] as const)
      .flatMap(key => profile[key] ? [[profileLabels[key], profile[key]!] as [string, string]] : []),
    ...(["housing", "experience", "activity"] as const)
      .flatMap(key => profile[key] ? [[{housing:"Wohnumgebung", experience:"Erfahrung", activity:"Aktivitätsbedarf"}[key], matchingValueLabel(key, profile[key]!)] as [string, string]] : []),
  ];

}
