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
  "/impressum",
  "/datenschutz",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Der Verein kommt aus dem Host, also enthaelt die Sitemap ausschliesslich
  // eigene URLs und traegt die eigene Adresse.
  const { tenant, scope } = await requireTenantWithSettings();
  const [siteUrl, animals, posts] = await Promise.all([
    getTenantSiteUrl(tenant),
    getAnimalSlugs(scope),
    getPublishedPostSlugs(scope),
  ]);

  return [
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
