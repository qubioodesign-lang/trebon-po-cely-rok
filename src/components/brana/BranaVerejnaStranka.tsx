import type { Viewport } from "next";
import { BranaHlavni } from "@/components/brana/BranaHlavni";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import {
  branaKonfiguraceVsechPohledu,
  nactiBranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { parseBranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";

type BranaSearchParams = Promise<{ pozadi?: string }>;

export type BranaPageProps = {
  searchParams: BranaSearchParams;
};

type BranaVerejnaStrankaProps = BranaPageProps & {
  stranka: BranaVerejnaStranka;
};

export async function generateBranaViewport(): Promise<Viewport> {
  const nocRezim = jeNocniRezimVPraze();

  return {
    viewportFit: "cover",
    themeColor: nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA,
  };
}

export async function BranaVerejnaStranka({
  stranka,
  searchParams,
}: BranaVerejnaStrankaProps) {
  const { pozadi } = await searchParams;
  const vychoziNocRezim = jeNocniRezimVPraze();
  const pohledovaData = nactiBranaSdilenaPohledovaData();
  const konfiguracePohledu = branaKonfiguraceVsechPohledu();

  return (
    <BranaHlavni
      stranka={stranka}
      pohledovaData={pohledovaData}
      konfiguracePohledu={konfiguracePohledu}
      variantaPozadi={parseBranaPozadiVarianta(pozadi)}
      vychoziNocRezim={vychoziNocRezim}
    />
  );
}
