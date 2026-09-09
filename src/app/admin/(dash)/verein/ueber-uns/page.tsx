import { requireOwner } from "@/lib/auth";
import { requireOwnSettings } from "@/lib/tenant";
import { VereinAbschnitt } from "@/components/admin/verein-abschnitt";
import { UeberUnsForm } from "@/components/admin/verein-forms-media";

export default async function Page() {
  const { scope } = await requireOwner();
  const settings = await requireOwnSettings(scope);

  return (
    <VereinAbschnitt titel="Über den Verein">
      <UeberUnsForm settings={settings} />
    </VereinAbschnitt>
  );
}
