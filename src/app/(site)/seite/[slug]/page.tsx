import { notFound } from "next/navigation";
import { requireTenantWithSettings } from "@/lib/tenant";
import { PageRenderer } from "@/components/website/renderer";
import { websiteContent } from "@/lib/website/content";
import { parseAnrede } from "@/lib/anrede";
export async function generateMetadata({ params }: PageProps<"/seite/[slug]">) {
  const { settings } = await requireTenantWithSettings();
  const { slug } = await params;
  const page = settings.website?.published?.pages.find(p => p.slug === slug && !["home", "verein"].includes(slug));
  return page ? { title: page.title, description: page.description } : {};
}
export default async function Page({ params }: PageProps<"/seite/[slug]">) {
  const { settings, scope } = await requireTenantWithSettings();
  const { slug } = await params;
  const site = settings.website?.published;
  const page = site?.pages.find(p => p.slug === slug && !["home", "verein"].includes(slug));
  if (!site || !page) notFound();
  return <main><PageRenderer site={site} page={page} content={await websiteContent(scope)} anrede={parseAnrede(settings.visitorAddress)}/></main>;
}
