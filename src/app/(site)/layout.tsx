import type { CSSProperties } from "react";
import { AnredeProvider } from "@/components/anrede-provider";
import { parseAnrede } from "@/lib/anrede";
import { designVars, fontCss } from "@/lib/website/design";
import { pagePath } from "@/lib/website/schema";
import "@/components/website/website.css";
import "@/components/website/stilwelten.css";
import { PublicMotion } from "@/components/public-motion";
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
 const site = settings.website?.published;
 const pages = site?.pages.filter(p => p.navigation && !["home", "verein"].includes(p.slug)).map(p => ({ href: pagePath(p), label: p.title })) ?? [];
 return <AnredeProvider value={parseAnrede(settings.visitorAddress)}><div data-website-style={site?.design.style} style={site ? designVars(site.design) as CSSProperties : undefined}><style>{fontCss()}</style><TenantTheme /><SiteHeader shortName={settings.shortName} logoUrl={settings.logoUrl} pages={pages} /><div className="flex-1" data-motion-surface>{children}<PublicMotion enabled={settings.animationsEnabled} /></div><SiteFooter settings={settings} /></div></AnredeProvider>;
}
