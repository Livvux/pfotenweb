import { z } from "zod";
export function validateEnv(input: NodeJS.ProcessEnv = process.env) {
 return z.object({ DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//), SITE_URL: z.url(), UPLOAD_DIR: z.string().optional() }).parse(input);
}
