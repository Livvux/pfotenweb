import { requireOwner } from "@/lib/auth";
import { requireOwnSettings } from "@/lib/tenant";
import { getAnimalCount } from "@/lib/animals";
import { settingsChecklist, missingRequired } from "@/lib/settings-status";
import { ChecklistListe } from "@/components/admin/setup-checklist";
import { IdentitaetForm } from "@/components/admin/verein-forms";
import { VereinAbschnitt } from "@/components/admin/verein-abschnitt";

export default async function VereinPage() {
  const { scope } = await requireOwner();
  const settings = await requireOwnSettings(scope);
  // getAnimalCount statt getAnimals().length: die Checkliste braucht die Zahl,
  // nicht jedes Tier samt Fotos.
  const liste = settingsChecklist(settings, {
    animals: await getAnimalCount(scope),
  });
  const offen = missingRequired(liste);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          {offen.length === 0
            ? "Ihre Angaben sind vollständig"
            : `Noch ${offen.length} ${offen.length === 1 ? "Punkt" : "Punkte"} offen`}
        </h2>
        <div className="mt-4">
          <ChecklistListe liste={liste} />
        </div>
      </section>

      <VereinAbschnitt titel="Name des Vereins">
        <IdentitaetForm settings={settings} />
      </VereinAbschnitt>
    </div>
  );
}
