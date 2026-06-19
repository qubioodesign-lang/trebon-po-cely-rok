import type { Metadata } from "next";
import { ziskatAktivniPolozky, ziskatPolozku } from "@/lib/polozky";
import { SDILENI_TEXT, SDILENI_TITULEK } from "@/lib/sdileni";
import { sestavitUrlPolozky } from "@/lib/url-polozky";

/** Absolutní URL pro og:image a og:url */
export function sestavitAbsolutniUrl(cesta: string, zakladUrl: string): string {
  if (cesta.startsWith("http://") || cesta.startsWith("https://")) {
    return cesta;
  }
  return `${zakladUrl}${cesta.startsWith("/") ? cesta : `/${cesta}`}`;
}

/** Základ URL webu z hlaviček požadavku (Vercel / lokální dev) */
export function sestavitZakladUrl(hlavicky: Headers): string {
  const host = hlavicky.get("host");
  if (!host) {
    return "http://localhost:3000";
  }
  const protocol = hlavicky.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

function metadataProObrazek(obrazekUrl: string, strankaUrl: string): Metadata {
  return {
    title: SDILENI_TITULEK,
    description: SDILENI_TEXT,
    openGraph: {
      title: SDILENI_TITULEK,
      description: SDILENI_TEXT,
      url: strankaUrl,
      type: "website",
      locale: "cs_CZ",
      images: [{ url: obrazekUrl, alt: SDILENI_TITULEK }],
    },
    twitter: {
      card: "summary_large_image",
      title: SDILENI_TITULEK,
      description: SDILENI_TEXT,
      images: [obrazekUrl],
    },
  };
}

/** Open Graph metadata pro úvodní stránku – dynamicky podle sdílené položky */
export async function ziskatMetadataGalerie(
  polozkaId: string | undefined,
  oidcZHeaderu: string | null,
  hlavicky: Headers
): Promise<Metadata> {
  const zakladUrl = sestavitZakladUrl(hlavicky);

  if (polozkaId) {
    const polozka = await ziskatPolozku(polozkaId, oidcZHeaderu);
    if (polozka?.aktivni) {
      const obrazekUrl = sestavitAbsolutniUrl(
        sestavitUrlPolozky(polozka.soubor),
        zakladUrl
      );
      const strankaUrl = `${zakladUrl}/?polozka=${encodeURIComponent(polozkaId)}`;
      return metadataProObrazek(obrazekUrl, strankaUrl);
    }
  }

  const polozky = await ziskatAktivniPolozky(oidcZHeaderu);
  if (polozky.length > 0) {
    const obrazekUrl = sestavitAbsolutniUrl(polozky[0].url, zakladUrl);
    return metadataProObrazek(obrazekUrl, zakladUrl);
  }

  return metadataProObrazek(`${zakladUrl}/apple-icon`, zakladUrl);
}
