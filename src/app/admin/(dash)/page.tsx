import Link from "next/link";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { canAccess } from "@/lib/roles";
import { requireAdmin } from "@/lib/auth";
import { getDashboardStats } from "@/lib/inquiries";
import { getSettings } from "@/lib/tenant";
import { isReadyForReview, settingsChecklist } from "@/lib/settings-status";
import { SetupChecklist } from "@/components/admin/setup-checklist";

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const { scope, role } = user;
  const inquiriesAllowed = canAccess(user, "inquiries");
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
    ...(canAccess(user, "animals") ? [{ label: "Tiere insgesamt", value: stats.animalsTotal, href: "/admin/tiere" }, { label: "davon vermittelbar", value: stats.animalsAvailable, href: "/admin/tiere?status=vermittelbar" }] : []),
    ...(canAccess(user, "posts") ? [{ label: "News-Beiträge", value: stats.postsTotal, href: "/admin/aktuelles" }] : []),
    ...(inquiriesAllowed ? [{ label: "Offene Anfragen", value: stats.openInquiries, href: "/admin/anfragen" }] : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Guten Tag!" eyebrow={settings?.shortName ?? "Vereinsverwaltung"} description="Einrichtungsstand und aktuelle Aufgaben im Überblick."/>

      {zeigeCheckliste ? (
        <SetupChecklist
          liste={liste}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(card => <StatCard key={card.label} {...card}/>)}
      </div>

      {inquiriesAllowed ? <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
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
      </section> : null}
    </div>
  );
}
