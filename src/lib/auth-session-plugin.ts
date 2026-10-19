import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
/** Only server code that already consumed a verified challenge can call this. */
export const verifiedSession = () => ({
  id: "pfotenweb-verified-session",
  endpoints: {
    createVerifiedSession: createAuthEndpoint("/pfotenweb/verified-session", {
      method: "POST", body: z.object({ userId: z.number().int().positive() }), metadata: { SERVER_ONLY: true },
    }, async ctx => {
      const [account] = await db.select({ active: users.active }).from(users).where(eq(users.id, ctx.body.userId));
      if (!account?.active) throw ctx.error("UNAUTHORIZED", { message: "Zugang nicht aktiv." });
      const user = await ctx.context.internalAdapter.findUserById(String(ctx.body.userId));
      if (!user) throw ctx.error("UNAUTHORIZED");
      const session = await ctx.context.internalAdapter.createSession(user.id, false);
      await setSessionCookie(ctx, { session, user });
      return ctx.json({ ok: true });
    }),
  },
}) satisfies BetterAuthPlugin;
