import { requireOwner } from "@/lib/auth";
import { getDonations } from "@/lib/donations";
import { DonationsForm } from "@/components/admin/donations-form";
export default async function DonationsAdminPage() {
  const { scope } = await requireOwner();
  return <div className="space-y-6"><h1 className="font-display text-3xl">Spenden</h1><DonationsForm values={await getDonations(scope)} /></div>;
}
