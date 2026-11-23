import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { sitemapProHost } from "@/lib/seo-verejne-adresy";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  return sitemapProHost(host);
}
