import type { Metadata } from "next";
import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";
import { BRANA_POPIS } from "@/lib/brana/konstanty";
import {
  jeBranaFacebookFbk,
  najitBranaFacebookNahled,
  sestavitBranaFacebookOdkaz,
} from "@/lib/brana/facebook-nahled";

export const generateViewport = generateBranaViewport;

const NAZEV_NAHLEDU = "BRÁNA do Třeboně";

const METADATA_BEZNEHO_DNES: Metadata = {
  title: { absolute: "Třeboň dnes – co se děje v Třeboni | BRÁNA" },
  description:
    "Co se dnes děje v Třeboni? Vybrané kulturní a další akce s místem a časem konání.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz" },
};

/** Běžné Dnes bez platného fbk má titulek pro vyhledávač. Uložený facebookový snímek se nemění. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ fbk?: string | string[] }>;
}): Promise<Metadata> {
  try {
    const { fbk } = await searchParams;
    if (typeof fbk !== "string" || !jeBranaFacebookFbk(fbk)) {
      return METADATA_BEZNEHO_DNES;
    }

    const nahled = await najitBranaFacebookNahled(fbk);
    if (!nahled) {
      return {};
    }

    const odkaz = sestavitBranaFacebookOdkaz(fbk);
    return {
      openGraph: {
        title: NAZEV_NAHLEDU,
        description: BRANA_POPIS,
        url: odkaz,
        type: "website",
        locale: "cs_CZ",
        images: [
          {
            url: nahled.url,
            alt: NAZEV_NAHLEDU,
            type: nahled.contentType,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: NAZEV_NAHLEDU,
        description: BRANA_POPIS,
        images: [nahled.url],
      },
    };
  } catch {
    return {};
  }
}

/** Kořenová stránka projektu Brána – /brana (Dnes) */
export default function StrankaBrana({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="dnes" searchParams={searchParams} />;
}
