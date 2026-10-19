import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { magicLink, username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "./password";
import { verifiedSession } from "./auth-session-plugin";
import { sendMessage } from "./email";
const site = new URL(process.env.SITE_URL ?? "http://localhost:3000");
const production = process.env.NODE_ENV === "production";
async function securityMail(userId: number, subject: string, path: string, token: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user?.active || !user.recoveryEmail || !user.recoveryEmailVerifiedAt || user.email !== user.recoveryEmail) return;
  await sendMessage({ to: user.recoveryEmail, subject, orgName: "Pfotenweb", text: `${subject}\n\n${new URL(path, site).href}#token=${encodeURIComponent(token)}\n\nDieser Link ist zeitlich begrenzt und nur einmal verwendbar.` });
}
export const auth = betterAuth({
  appName: "Pfotenweb", secret: process.env.BETTER_AUTH_SECRET,
  baseURL: site.origin, trustedOrigins: [site.origin],
  database: drizzleAdapter(db, { provider: "pg", schema: { ...schema, user: schema.users, session: schema.authSessions, account: schema.authAccounts, verification: schema.authVerifications, passkey: schema.authPasskeys } }),
  // Username/password actions retain the installation's database-backed limit.
  // The HTTP gateway does not expose their duplicate raw login endpoints.
  rateLimit: { enabled: false },
  advanced: { database: { generateId: "serial" }, useSecureCookies: false, cookiePrefix: production ? "__Host-tsh" : "tsh", ...(production ? { defaultCookieAttributes: { secure: true } } : {}) },
  user: { additionalFields: { tenantId: { type: "number", input: false, required: true, defaultValue: 1 }, role: { type: "string", input: false, required: false }, active: { type: "boolean", input: false, required: false }, permissions: { type: "string[]", input: false, required: false } } },
  session: { expiresIn: 60 * 60 * 24 * 30 },
  verification: { storeIdentifier: "hashed" },
  emailAndPassword: {
    enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 200,
    password: { hash: hashPassword, verify: ({ password, hash }) => verifyPassword(password, hash) },
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => securityMail(Number(user.id), "Passwort zurücksetzen", "/admin/passwort-zuruecksetzen", token),
  },
  databaseHooks: {
    user: { create: { before: async () => { throw new APIError("FORBIDDEN", { message: "Neue Zugänge werden vom Verein angelegt." }); } } },
    session: { create: { before: async session => {
      const [user] = await db.select({ active: schema.users.active }).from(schema.users).where(eq(schema.users.id, Number(session.userId)));
      if (!user?.active) throw new APIError("UNAUTHORIZED", { message: "Zugang nicht aktiv." });
      return { data: session };
    } } },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 50, usernameNormalization: false, usernameValidator: value => value.length >= 3 && value.length <= 50 }),
    passkey({ rpID: site.hostname, rpName: "Pfotenweb", origin: site.origin }),
    magicLink({ disableSignUp: true, expiresIn: 300, storeToken: "hashed", sendMagicLink: async ({ email, token }) => {
      const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
      if (user) await securityMail(user.id, "Bei Pfotenweb anmelden", "/admin/link-anmelden", token);
    } }),
    verifiedSession(), nextCookies(),
  ],
});
