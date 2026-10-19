import { getAdminUser } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { requireOwnSettings } from "@/lib/tenant";
import { animalPdfData } from "@/lib/animal-downloads";
import { renderAnimalPdf } from "@/lib/animal-pdf";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return new Response(null, { status: 401 });
  if (!canAccess(user, "animals")) return new Response(null, { status: 403 });
  if (!await rateLimit(`animal-pdf:${user.id}:${await clientIp()}`, 20)) return new Response(null, { status: 429 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404 });
  const animal = await animalPdfData(user.scope, await requireOwnSettings(user.scope), id);
  if (!animal) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(await renderAnimalPdf([animal])), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="tiersteckbrief-${id}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
