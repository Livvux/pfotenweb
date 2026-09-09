import { requireOwner } from "@/lib/auth";
import { requireOwnSettings } from "@/lib/tenant";
import { VereinAbschnitt } from "@/components/admin/verein-abschnitt";
import { KontaktForm } from "@/components/admin/verein-forms";

export default async function Page() {
  const { scope } = await requireOwner();
  const settings = await requireOwnSettings(scope);

  return (
    <VereinAbschnitt titel="Kontakt und Anschrift">
      <KontaktForm settings={settings} />
    </VereinAbschnitt>
  );
}
