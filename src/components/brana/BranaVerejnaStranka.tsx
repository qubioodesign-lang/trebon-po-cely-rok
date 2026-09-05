import type { Viewport } from "next";
import { BranaHlavni } from "@/components/brana/BranaHlavni";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { branaKonfiguraceVsechPohledu } from "@/lib/brana/pohledy-data";
import { parseBranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import { nactiVerejnouVetuAtmosfery } from "@/lib/brana/atmosfera-verejne";
import {
  nactiVerejneSchvalenePohledovaData,
  prazdnaVerejnaPohledovaDataPriChybe,
} from "@/lib/brana/verejne-schvalene-pohledy";

type BranaSearchParams = Promise<{ pozadi?: string }>;

export type BranaPageProps = {
  searchParams: BranaSearchParams;
};

type BranaVerejnaStrankaProps = BranaPageProps & {
  stranka: BranaVerejnaStranka;
};

export async function generateBranaViewport(): Promise<Viewport> {
  return {
    viewportFit: "cover",
    themeColor: "#FAF8F5",
  };
}

export async function BranaVerejnaStranka({
  stranka,
  searchParams,
}: BranaVerejnaStrankaProps) {
  const { pozadi } = await searchParams;
  const vychoziNocRezim = jeNocniRezimVPraze();
  const schvalene = await nactiVerejneSchvalenePohledovaData(stranka);
  // Fail-closed: při chybě prázdná projekce – bez mixu s provizorními daty.
  const pohledovaData = schvalene.ok
    ? schvalene.data
    : prazdnaVerejnaPohledovaDataPriChybe(stranka);
  const konfiguracePohledu = branaKonfiguraceVsechPohledu();
  // Atmosféra jen DNES; fail-soft null = vůbec nerenderovat.
  const atmosferaVeta =
    stranka === "dnes" ? await nactiVerejnouVetuAtmosfery() : null;

  return (
    <BranaHlavni
      stranka={stranka}
      pohledovaData={pohledovaData}
      konfiguracePohledu={konfiguracePohledu}
      variantaPozadi={parseBranaPozadiVarianta(pozadi)}
      vychoziNocRezim={vychoziNocRezim}
      atmosferaVeta={atmosferaVeta}
    />
  );
}
