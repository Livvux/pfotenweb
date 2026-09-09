import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireActiveTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string; filename: string }> }) {
  const { tenant, filename } = await params;
  if (!/^t[1-9]\d*$/.test(tenant) || !/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(filename)) return new Response(null, { status: 404 });
  const owner = await requireActiveTenant();
  if (tenant !== `t${owner.id}`) return new Response(null, { status: 404 });
  try {
    // Runtime uploads live in a volume, never in the standalone build trace.
    const bytes = await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public/uploads"), tenant, filename));
    const ext = path.extname(filename);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": ext === ".jpg" ? "image/jpeg" : ext === ".png" ? "image/png" : "image/webp",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return new Response(null, { status: 404 });
    throw error;
  }
}
