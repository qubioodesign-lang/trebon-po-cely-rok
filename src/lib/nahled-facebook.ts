import type { Metadata } from "next";
import { ziskatTretiSouborProlnuti } from "@/lib/polozka-soubory";
import { SDILENI_TEXT, SDILENI_TITULEK } from "@/lib/sdileni";
import { sestavitUrlPolozky } from "@/lib/url-polozky";
import type { Polozka } from "@/types";

function absolutniUrl(cesta: string, zakladUrl: string): string {
  if (cesta.startsWith("http://") || cesta.startsWith("https://")) {
    return cesta;
  }
  return `${zakladUrl}${cesta.startsWith("/") ? cesta : `/${cesta}`}`;
}

/**
 * Open Graph pro ?nahled=<id>.
 * Bere třetí snímek i u skrytého prolnutí, dokud je soubor v metadatech.
 * Bez třetího snímku nevrací nic – volající použije běžný úvod.
 */
export function metadataNahleduProlnuti(
  polozka: Pick<Polozka, "id" | "typ" | "soubor" | "soubory"> | null,
  zakladUrl: string
): Metadata | null {
  if (!polozka) return null;
  const tretiSoubor = ziskatTretiSouborProlnuti(polozka);
  if (!tretiSoubor) return null;

  const obrazekUrl = absolutniUrl(sestavitUrlPolozky(tretiSoubor), zakladUrl);
  const strankaUrl = `${zakladUrl}/?nahled=${encodeURIComponent(polozka.id)}`;
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
