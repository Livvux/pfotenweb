import { requireOwner } from "@/lib/auth";
import { readBody } from "@/lib/request-body";
import { createImport, importError, uploadImportImage } from "@/lib/content-import/service";
import { MAX_SOURCE_BYTES } from "@/lib/content-import/types";
import { MAX_UPLOAD_BYTES } from "@/lib/content-import/storage";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await requireOwner();
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return Response.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  if (!(await rateLimit(`import:${user.tenant.id}:${user.id}`, 120, 15 * 60_000))) return Response.json({ error: "Bitte später erneut versuchen." }, { status: 429 });
  const image = new URL(request.url).searchParams.get("kind") === "image";
  const body = await readBody(request, image ? MAX_UPLOAD_BYTES : MAX_SOURCE_BYTES);
  if (!body) return Response.json({ error: image ? "Bild ist größer als 5 MB." : "Datei ist größer als 10 MB." }, { status: 413 });
  try {
    if (image) {
      const params = new URL(request.url).searchParams;
      const candidateId = Number(params.get("candidate")), imageId = params.has("image") ? Number(params.get("image")) : null;
      if (!Number.isSafeInteger(candidateId) || candidateId < 1 || (imageId !== null && (!Number.isSafeInteger(imageId) || imageId < 1))) throw new Error("Ungültige Bildzuordnung.");
      await uploadImportImage(user.scope, user.id, candidateId, imageId, Buffer.from(body));
      return Response.json({ success: true });
    }
    const format = request.headers.get("x-import-format");
    if (format !== "csv" && format !== "wordpress") throw new Error("Bitte CSV oder WordPress-XML auswählen.");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const id = await createImport(user.scope, user.id, source, format, decodeURIComponent(request.headers.get("x-import-name") ?? "Import"), decodeURIComponent(request.headers.get("x-import-source") ?? ""));
    return Response.json({ id });
  } catch (error) { return Response.json({ error: importError(error) }, { status: 400 }); }
}
