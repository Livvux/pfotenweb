import type { MetadataRoute } from "next";
import { getCurrentTenant, getTenantSiteUrl } from "@/lib/tenant";
export default async function robots(): Promise<MetadataRoute.Robots> {
 if (!(await getCurrentTenant())) return { rules: { userAgent: "*", disallow: "/" } };
 return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }, sitemap: `${await getTenantSiteUrl()}/sitemap.xml` };
}
