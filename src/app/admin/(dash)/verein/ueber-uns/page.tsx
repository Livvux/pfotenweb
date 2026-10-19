import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { requireOwnSettings } from "@/lib/tenant";
import { VereinAbschnitt } from "@/components/admin/verein-abschnitt";
import { UeberUnsForm } from "@/components/admin/verein-forms-media";

export default async function Page() {
  const { scope } = await requireOwner();
  const settings = await requireOwnSettings(scope);

  if (settings.website) return <VereinAbschnitt titel="Über den Verein"><p>Diese Inhalte werden im Website-Editor gepflegt.</p><Link href="/admin/website" className="inline-flex min-h-11 items-center underline">Website gestalten</Link></VereinAbschnitt>;

  return (
    <VereinAbschnitt titel="Über den Verein">
      <UeberUnsForm settings={settings} />
    </VereinAbschnitt>
  );
}
