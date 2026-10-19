import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { assertCurrentAccess, assertFreshAuthentication } from "@/lib/access";
import { auth } from "@/lib/auth-config";
import { getAdminUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
const publicPaths = new Set(["/passkey/generate-authenticate-options", "/passkey/verify-authentication"]);
const protectedPaths = new Set(["/get-session", "/sign-out", "/passkey/list-user-passkeys"]);
const securityPaths = new Set(["/passkey/generate-register-options", "/passkey/verify-registration", "/passkey/delete-passkey", "/passkey/update-passkey"]);
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  // Password/code/link requests go through the database-limited server actions.
  if (!publicPaths.has(path) && !protectedPaths.has(path) && !securityPaths.has(path)) return new Response(null, { status: 404 });
  if (!await rateLimit(`auth:${path}:${await clientIp()}`, 30, 60_000)) return Response.json({ message: "Bitte kurz warten und erneut versuchen." }, { status: 429 });
  if (!publicPaths.has(path)) {
    const user = await getAdminUser();
    if (!user) return Response.json({ message: "Bitte erneut anmelden." }, { status: 401 });
    if (securityPaths.has(path)) {
      return db.transaction(async tx => {
        await tx.select().from(tenants).where(eq(tenants.id, user.scope.tenantId)).for("update");
        try { await assertCurrentAccess(tx, user, "self"); await assertFreshAuthentication(tx, user); }
        catch { return Response.json({ message: "Bitte unter Konto Passwort oder E-Mail-Code bestätigen." }, { status: 403 }); }
        return auth.handler(request);
      });
    }
  }
  return auth.handler(request);
}
export const handleAuthRequest = handle;
