import { getAdminUser } from "@/lib/auth";
import { adminNotifications } from "@/lib/admin-notifications";
export async function GET() {
  const user = await getAdminUser();
  if (!user) return new Response(null, { status: 401 });
  return Response.json(await adminNotifications(user), { headers: { "cache-control": "private, no-store" } });
}
