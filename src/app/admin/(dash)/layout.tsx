import "../admin.css";
import { AnredeProvider } from "@/components/anrede-provider";
import { parseAnrede } from "@/lib/anrede";
import { canAccess } from "@/lib/roles";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminNotifications, tourCompleted } from "@/lib/admin-notifications";
import { logoutAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { TenantTheme } from "@/components/tenant-theme";
import { getSettings } from "@/lib/tenant";

/**
 * nurOwner: die Seite selbst und ihre Aktionen pruefen die Rolle ohnehin. Das
 * Ausblenden hier ist keine Absicherung, sondern Freundlichkeit: ein Menuepunkt,
 * der immer auf eine Absage fuehrt, gehoert nicht ins Menue.
 */
const nav = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/tiere", label: "Tiere", area: "animals" as const },
  { href: "/admin/aktuelles", label: "Aktuelles", area: "posts" as const },
  { href: "/admin/anfragen", label: "Anfragen", area: "inquiries" as const },
  { href: "/admin/verein", label: "Verein", nurOwner: true },
  { href: "/admin/import", label: "Inhalte übernehmen", nurOwner: true },
  { href: "/admin/daten", label: "Datenexport", nurOwner: true },
  { href: "/admin/website", label: "Website gestalten", nurOwner: true },
  { href: "/admin/spenden", label: "Spenden", nurOwner: true },
  { href: "/admin/konto", label: "Konto und Sicherheit" },
  { href: "/admin/mitglieder", label: "Unser Team" },
  { href: "/admin/team", label: "Zugänge", nurOwner: true },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();
  const settings = await getSettings(user.scope.tenantId);
  const sichtbar = nav.filter(item => (!item.nurOwner || user.role === "owner") && (!item.area || canAccess(user, item.area)));

  const [{ unread }, completed] = await Promise.all([adminNotifications(user), tourCompleted(user)]);
  const brand = <Link href="/admin" className="flex items-center gap-2 font-serif text-lg"><BrandMark logoUrl={settings?.logoUrl ?? null} className="h-8 w-8" fallbackClassName="text-brand-800"/>{settings?.shortName ?? "Verwaltung"}</Link>;
  const account = <><p className="text-sm text-stone-500">Angemeldet: {user.username}</p><Link href="/admin/konto" className="admin-button">Profil und Sicherheit</Link><form action={logoutAction}><button className="admin-button">Abmelden</button></form></>;
  return <AnredeProvider value={parseAnrede(settings?.adminAddress)}><TenantTheme/><AdminShell brand={brand} account={account} nav={sichtbar} unread={unread} inquiriesAllowed={canAccess(user, "inquiries")} firstVisit={!completed}>{children}</AdminShell></AnredeProvider>;
}
