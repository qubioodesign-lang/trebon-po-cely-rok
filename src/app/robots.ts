import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { robotsProHost } from "@/lib/seo-verejne-adresy";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  return robotsProHost(host);
}
