import type { MetadataRoute } from "next";
import { BRANA_SUBDOMENA_HOST, TREBON_PRODUKCNI_URL } from "@/lib/brana/cesty";

export const SEO_HOST_WWW = new URL(TREBON_PRODUKCNI_URL).host;
export const SEO_HOST_BRANA = BRANA_SUBDOMENA_HOST;

export const SEO_CESTY_WWW = ["/", "/informace"] as const;
export const SEO_CESTY_BRANA = [
  "/",
  "/zitra",
  "/vikend",
  "/7-dni",
  "/vyhled",
  "/informace",
] as const;

/**
 * Konkrétní zákazy pro oba produkční hostitele.
 * Plošné /brana ani technické soubory veřejné PWA tu nejsou.
 */
export const SEO_ROBOTS_ZAKAZY = [
  "/admin",
  "/brana/admin",
  "/api/",
  "/vzkaz",
  "/brana/vzkaz",
  "/dekujeme",
  "/chci-se-vracet",
  "/zkouska-chrome",
  "/brana/zitra",
  "/brana/vikend",
  "/brana/7-dni",
  "/brana/vyhled",
  "/brana/informace",
] as const;

/**
 * Disallow: /admin je prefix, takže by sám zakryl /admin/sw.js.
 * Delší Allow nechá tuto cestu workeru robotům dostupnou.
 */
export const SEO_ROBOTS_POVOLENA_CESTA = "/admin/sw.js";

export type SeoHostDruh = "www" | "brana" | "neznamy";

export function normalizovatSeoHost(host: string | null | undefined): string {
  return host?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function druhSeoHostitele(host: string | null | undefined): SeoHostDruh {
  const cisty = normalizovatSeoHost(host);
  if (cisty === SEO_HOST_BRANA) {
    return "brana";
  }
  if (cisty === SEO_HOST_WWW) {
    return "www";
  }
  return "neznamy";
}

function zakladProdukce(druh: Exclude<SeoHostDruh, "neznamy">): string {
  return druh === "brana"
    ? `https://${SEO_HOST_BRANA}`
    : `https://${SEO_HOST_WWW}`;
}

export function urlSitemapProHost(host: string | null | undefined): string[] {
  const druh = druhSeoHostitele(host);
  if (druh === "neznamy") {
    return [];
  }
  const zaklad = zakladProdukce(druh);
  const cesty = druh === "brana" ? SEO_CESTY_BRANA : SEO_CESTY_WWW;
  return cesty.map((cesta) => (cesta === "/" ? `${zaklad}/` : `${zaklad}${cesta}`));
}

export function sitemapProHost(
  host: string | null | undefined,
): MetadataRoute.Sitemap {
  return urlSitemapProHost(host).map((url) => ({ url }));
}

export function robotsProHost(
  host: string | null | undefined,
): MetadataRoute.Robots {
  const druh = druhSeoHostitele(host);
  if (druh === "neznamy") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: SEO_ROBOTS_POVOLENA_CESTA,
      disallow: [...SEO_ROBOTS_ZAKAZY],
    },
    sitemap: `${zakladProdukce(druh)}/sitemap.xml`,
  };
}
