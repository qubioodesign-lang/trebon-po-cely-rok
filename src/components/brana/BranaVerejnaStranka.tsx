import type { Viewport } from "next";
import { BranaHlavni } from "@/components/brana/BranaHlavni";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import {
  parseBranaNocRezim,
  parseBranaPozadiVarianta,
} from "@/lib/brana/pozadi-varianty";

type BranaSearchParams = Promise<{ pozadi?: string; noc?: string }>;

export type BranaPageProps = {
  searchParams: BranaSearchParams;
};

type BranaVerejnaStrankaProps = BranaPageProps & {
  stranka: BranaVerejnaStranka;
};

export async function generateBranaViewport({
  searchParams,
}: {
  searchParams: BranaSearchParams;
}): Promise<Viewport> {
  const { noc } = await searchParams;

  return {
    viewportFit: "cover",
    themeColor: parseBranaNocRezim(noc)
      ? BRANA_PWA_NOC_BARVA
      : BRANA_PWA_DEN_BARVA,
  };
}

export async function BranaVerejnaStranka({
  stranka,
  searchParams,
}: BranaVerejnaStrankaProps) {
  const { pozadi, noc } = await searchParams;

  return (
    <BranaHlavni
      stranka={stranka}
      variantaPozadi={parseBranaPozadiVarianta(pozadi)}
      nocRezim={parseBranaNocRezim(noc)}
    />
  );
}
