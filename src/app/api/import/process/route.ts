import { getAdminUser } from "@/lib/auth";
import { runImports, importError } from "@/lib/content-import/service";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return new Response(null, { status: 401 });
  if (user.role !== "owner") return new Response(null, { status: 403 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return new Response(null, { status: 403 });
  if (!await rateLimit(`import-process:${user.id}`, 60)) return new Response(null, { status: 429 });
  try { await runImports(); return Response.json({ success: true }); }
  catch (error) { return Response.json({ error: importError(error) }, { status: 400 }); }
}
