import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requireOwner, authorizeOwnerExport } from "@/lib/auth";
import { createDataExport } from "@/lib/data-export";
import { rateLimit } from "@/lib/rate-limit";

import { readBody } from "@/lib/request-body";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await requireOwner();
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return new Response("Ungültiger Ursprung.", { status: 403 });
  if (!(await rateLimit(`export:${user.id}:${user.tenant.id}`))) return new Response("Bitte später erneut versuchen.", { status: 429 });
  const body = await readBody(request, 4096);
  if (!body) return new Response("Anfrage zu groß.", { status: 413 });
  const form = await new Response(Buffer.from(body), { headers: { "content-type": request.headers.get("content-type") ?? "application/x-www-form-urlencoded" } }).formData();
  if (!(await authorizeOwnerExport(user, String(form.get("password") ?? "")))) return new Response("Bestätigung fehlt oder ist abgelaufen. Bitte das Passwort prüfen oder unter Konto einen frischen E-Mail-Code bestätigen.", { status: 403 });
  const archive = await createDataExport(user.tenant.id);
  const stream = createReadStream(archive.file);
  stream.on("close", () => { archive.cleanup().catch(() => console.error("Export-Bereinigung fehlgeschlagen")); });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: {
    "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="pfotenweb-export.tar.gz"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
