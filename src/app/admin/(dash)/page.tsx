import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDashboardStats } from "@/lib/inquiries";
import { getSettings } from "@/lib/tenant";
import { isReadyForReview, settingsChecklist } from "@/lib/settings-status";
import { SetupChecklist } from "@/components/admin/setup-checklist";

export default async function AdminDashboardPage() {
  const { scope, role } = await requireAdmin();
  const stats = await getDashboardStats(scope);
  const latest = stats.latestInquiries;

  /*
   * Der Einrichtungshinweis erscheint, solange die Seite nicht freigeschaltet
   * ist oder Pflichtpunkte fehlen. Und nur fuer Verantwortliche: die
   * verlinkten Seiten darf ein Redaktionszugang ohnehin nicht oeffnen.
   */
  const settings = role === "owner" ? await getSettings(scope.tenantId) : null;
  const liste = settings
    ? settingsChecklist(settings, { animals: stats.animalsTotal })
    : [];
  const zeigeCheckliste =
    liste.length > 0 && !isReadyForReview(liste);

  const cards = [
    { label: "Tiere insgesamt", value: stats.animalsTotal },
    { label: "davon vermittelbar", value: stats.animalsAvailable },
    { label: "News-Beiträge", value: stats.postsTotal },
    { label: "Offene Anfragen", value: stats.openInquiries },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-stone-900">Guten Tag!</h1>

      {zeigeCheckliste ? (
        <SetupChecklist
          liste={liste}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
          >
            <p className="font-serif text-4xl text-brand-800">{card.value}</p>
            <p className="mt-1 text-sm text-stone-500">{card.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-stone-900">
            Neueste offene Anfragen
          </h2>
          <Link
            href="/admin/anfragen"
            className="text-sm font-medium text-brand-700 hover:text-brand-700"
          >
            Alle ansehen →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="text-sm text-stone-500">Keine offenen Anfragen.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {latest.map((inq) => (
              <li key={inq.id} className="py-3 text-sm">
                <span className="font-medium text-stone-900">{inq.name}</span>
                {inq.subject ? (
                  <span className="text-stone-500"> · {inq.subject}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
