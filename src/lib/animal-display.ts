import type { Animal } from "./animals";
export const SPECIES_LABELS: Record<Animal["species"], string> = {
  hund: "Hund",
  katze: "Katze",
  kleintier: "Kleintier",
  vogel: "Vogel",
  sonstiges: "Sonstiges",
};

export const STATUS_LABELS: Record<Animal["status"], string> = {
  vermittelbar: "Vermittelbar",
  reserviert: "Reserviert",
  vermittelt: "Vermittelt",
};

export function ageText(animal: Pick<Animal, "birthYear">): string {
  if (!animal.birthYear) return "";
  const years = new Date().getFullYear() - animal.birthYear;
  if (years <= 0) return "Jungtier";
  return `${years} ${years === 1 ? "Jahr" : "Jahre"}`;
}
