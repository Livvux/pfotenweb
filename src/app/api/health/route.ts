import { datenbankErreichbar } from "@/lib/health";

/*
 * Fuer den Healthcheck von Docker, Coolify oder einem Uptime-Dienst.
 *
 * Ohne Anmeldung erreichbar, verraet aber nichts: keine Version, keine
 * Zaehler, keine Vereinsliste. Ein Angreifer erfaehrt hier nur, ob die
 * Datenbank antwortet, und das sagt ihm auch jede andere Seite.
 *
 * Kein requirePlatformHost(): der Healthcheck laeuft ueber Loopback gegen den
 * Container, dort steht im Host-Header die Container-IP und keine
 * Plattformdomain.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await datenbankErreichbar();
  return Response.json({ ok }, { status: ok ? 200 : 503 });
}
