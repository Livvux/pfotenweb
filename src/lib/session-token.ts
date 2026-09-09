import { createHash, randomBytes } from "node:crypto";

const produktion = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = produktion
  ? "__Host-tsh_session"
  : "tsh_session";

/** In der Datenbank steht nur der Hash. Ein Datenbankleck ergibt keine Sitzung. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: produktion,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}
