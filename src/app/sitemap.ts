import type { MetadataRoute } from "next";
import { getAnimalSlugs } from "@/lib/animals";
import { getPublishedPostSlugs } from "@/lib/posts";
import { requireTenantWithSettings, getTenantSiteUrl } from "@/lib/tenant";

const staticRoutes = [
  "",
  "/tiere",
  "/aktuelles",
  "/verein",
  "/kontakt",
  "/spenden",
  "/impressum",
  "/datenschutz",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Der Verein kommt aus dem Host, also enthaelt die Sitemap ausschliesslich
  // eigene URLs und traegt die eigene Adresse.
  const { tenant, scope, settings } = await requireTenantWithSettings();
  const [siteUrl, animals, posts] = await Promise.all([
    getTenantSiteUrl(tenant),
    getAnimalSlugs(scope),
    getPublishedPostSlugs(scope),
  ]);

  return [
    ...(settings.website?.published?.pages.filter(p => !["home", "verein"].includes(p.slug)).map(p => ({ url: `${siteUrl}/seite/${p.slug}`, lastModified: settings.updatedAt })) ?? []),
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route}`,
    })),
    ...animals.map((animal) => ({
      url: `${siteUrl}/tiere/${animal.slug}`,
      lastModified: animal.updatedAt,
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/aktuelles/${post.slug}`,
      lastModified: post.updatedAt,
    })),
  ];
}
