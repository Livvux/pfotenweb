import { z } from "zod";
export const profileLabels = {
  age: "Altersangabe", birthDate: "Geburtsangabe", location: "Aufenthaltsort",
  dogs: "Verträglich mit Hunden", cats: "Verträglich mit Katzen", children: "Verträglich mit Kindern",
  health: "Gesundheit", character: "Charakter",
} as const;
const optionalText = z.string().trim().max(2000).optional();
export const profileSchema = z.object({
  age: optionalText, birthDate: optionalText, location: optionalText,
  dogs: optionalText, cats: optionalText, children: optionalText,
  health: optionalText, character: optionalText,
  housing: z.enum(["", "unbekannt", "wohnung-oder-haus", "haus", "haus-mit-garten"]).optional(),
  experience: z.enum(["", "unbekannt", "anfaenger", "erfahren"]).optional(),
  activity: z.enum(["", "unbekannt", "ruhig", "mittel", "aktiv"]).optional(),
}).strict();
export type AnimalProfile = z.infer<typeof profileSchema>;
export function profileFromForm(data: FormData): AnimalProfile {
  return profileSchema.parse(Object.fromEntries(Object.keys(profileSchema.shape).map(key => [key, String(data.get(`profile.${key}`) ?? "")])));
}
