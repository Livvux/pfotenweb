import { requireAdmin } from "./auth";
import { getSettings } from "./tenant";
import { parseAnrede } from "./anrede";
export async function getAdminAnrede() {
  const { scope } = await requireAdmin();
  return parseAnrede((await getSettings(scope.tenantId))?.adminAddress);
}
