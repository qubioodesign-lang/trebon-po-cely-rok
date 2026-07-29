import type { Viewport } from "next";
import { BranaHlavni } from "@/components/brana/BranaHlavni";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import {
  parseBranaNocRezim,
  parseBranaPozadiVarianta,
} from "@/lib/brana/pozadi-varianty";

/** Kořenová stránka projektu Brána – /brana */
export async function generateViewport({
  searchParams,
}: {
  searchParams: Promise<{ pozadi?: string; noc?: string }>;
}): Promise<Viewport> {
  const { noc } = await searchParams;

  return {
    viewportFit: "cover",
    themeColor: parseBranaNocRezim(noc)
      ? BRANA_PWA_NOC_BARVA
      : BRANA_PWA_DEN_BARVA,
  };
}

export default async function StrankaBrana({
  searchParams,
}: {
  searchParams: Promise<{ pozadi?: string; noc?: string }>;
}) {
  const { pozadi, noc } = await searchParams;
  const variantaPozadi = parseBranaPozadiVarianta(pozadi);
  const nocRezim = parseBranaNocRezim(noc);

  return <BranaHlavni variantaPozadi={variantaPozadi} nocRezim={nocRezim} />;
}
