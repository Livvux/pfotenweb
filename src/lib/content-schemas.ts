import { z } from "zod";
export { animalSchema } from "./animal-fields";
export const postSchema = z.object({
  title: z.string().trim().min(3, "Titel ist zu kurz.").max(180),
  body: z
    .string()
    .trim()
    .min(20, "Der Beitrag sollte mindestens 20 Zeichen enthalten.")
    .max(20000),
  published: z.boolean().default(false),
});
