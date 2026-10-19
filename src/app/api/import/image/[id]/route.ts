import { requireOwner } from "@/lib/auth";
import { importImageBytes } from "@/lib/content-import/service";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireOwner();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404 });
  const image = await importImageBytes(user.scope, id);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.body), { headers: { "Content-Type": image.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
