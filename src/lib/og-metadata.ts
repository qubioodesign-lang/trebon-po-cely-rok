import type { Metadata } from "next";
import { metadataNahleduProlnuti } from "@/lib/nahled-facebook";
import { ziskatAktivniPolozky, ziskatPolozku } from "@/lib/polozky";
import { ziskatHlavniSouborPolozky } from "@/lib/polozka-soubory";
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

/** Jednorázový pokus: široký výřez jen pro ?fbtest=1. Galerii nemění. */
function metadataFacebookTestu(zakladUrl: string): Metadata {
  const obrazekUrl = `${zakladUrl}/facebook-test-1200x630.jpg`;
  const strankaUrl = `${zakladUrl}/?fbtest=1`;
  return {
    title: SDILENI_TITULEK,
    description: SDILENI_TEXT,
    openGraph: {
      title: SDILENI_TITULEK,
      description: SDILENI_TEXT,
      url: strankaUrl,
      type: "website",
      locale: "cs_CZ",
      images: [
        {
          url: obrazekUrl,
          alt: SDILENI_TITULEK,
          width: 1200,
          height: 630,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SDILENI_TITULEK,
      description: SDILENI_TEXT,
      images: [obrazekUrl],
    },
  };
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
  hlavicky: Headers,
  nahledId?: string,
  fbtest?: string
): Promise<Metadata> {
  const zakladUrl = sestavitZakladUrl(hlavicky);

  if (polozkaId) {
    const polozka = await ziskatPolozku(polozkaId, oidcZHeaderu);
    if (polozka?.aktivni) {
      const hlavniSoubor = ziskatHlavniSouborPolozky(polozka);
      if (hlavniSoubor) {
        const obrazekUrl = sestavitAbsolutniUrl(
          sestavitUrlPolozky(hlavniSoubor),
          zakladUrl
        );
        const strankaUrl = `${zakladUrl}/?polozka=${encodeURIComponent(polozkaId)}`;
        return metadataProObrazek(obrazekUrl, strankaUrl);
      }
    }
  }

  if (nahledId && !polozkaId) {
    const polozka = await ziskatPolozku(nahledId, oidcZHeaderu);
    const nahled = metadataNahleduProlnuti(polozka, zakladUrl);
    if (nahled) return nahled;
  }

  if (fbtest === "1" && !polozkaId && !nahledId) {
    return metadataFacebookTestu(zakladUrl);
  }

  const polozky = await ziskatAktivniPolozky(oidcZHeaderu);
  if (polozky.length > 0) {
    const prvniUrl = polozky[0].url ?? polozky[0].urls?.[0];
    if (prvniUrl) {
      const obrazekUrl = sestavitAbsolutniUrl(prvniUrl, zakladUrl);
      return metadataProObrazek(obrazekUrl, zakladUrl);
    }
  }

  return metadataProObrazek(`${zakladUrl}/apple-icon`, zakladUrl);
}
