import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireTenantWithSettings } from "@/lib/tenant";
import { TenantTheme } from "@/components/tenant-theme";
export async function generateMetadata(): Promise<Metadata> {
 const { settings } = await requireTenantWithSettings();
 return { title: { default: settings.shortName, template: `%s – ${settings.shortName}` }, description: settings.tagline ?? undefined };
}
export default async function SiteLayout({ children }: { children: ReactNode }) {
 const { settings } = await requireTenantWithSettings();
 return <><TenantTheme /><SiteHeader shortName={settings.shortName} logoUrl={settings.logoUrl} /><div className="flex-1">{children}</div><SiteFooter settings={settings} /></>;
}
