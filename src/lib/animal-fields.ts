import { z } from "zod";
import { profileFromForm, profileSchema } from "./animal-profile-fields";

export const animalSchema = z.object({
  profile: profileSchema,
  name: z.string().trim().min(2, "Name ist zu kurz.").max(80),
  species: z.enum(["hund", "katze", "kleintier", "vogel", "sonstiges"]),
  breed: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
  sex: z.enum(["m", "w", "u"]),
  birthYear: z.coerce
    .number()
    .int()
    .min(1990, "Geburtsjahr ungültig.")
    .max(new Date().getFullYear(), "Geburtsjahr liegt in der Zukunft.")
    .optional(),
  size: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(["vermittelbar", "reserviert", "vermittelt"]),
  featured: z.boolean().optional().default(false),
  description: z
    .string()
    .trim()
    .min(20, "Beschreibung sollte mindestens 20 Zeichen enthalten.")
    .max(5000),
});


export function parseAnimal(formData: FormData) {
  const profile = profileSchema.safeParse(Object.fromEntries(Object.keys(profileSchema.shape).map(key => [key, String(formData.get(`profile.${key}`) ?? "")])));
  return animalSchema.safeParse({
    profile: profile.success ? profileFromForm(formData) : null,
    name: formData.get("name"),
    species: formData.get("species"),
    breed: formData.get("breed"),
    sex: formData.get("sex"),
    birthYear: formData.get("birthYear") || undefined,
    size: formData.get("size"),
    status: formData.get("status"),
    featured: formData.get("featured") === "on",
    description: formData.get("description"),
  });
}
