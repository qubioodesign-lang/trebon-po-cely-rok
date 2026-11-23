import type { Metadata } from "next";
import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const metadata: Metadata = {
  title: { absolute: "Třeboň o víkendu – program akcí | BRÁNA" },
  description: "Co se děje v Třeboni o víkendu? Vybrané akce na sobotu a neděli.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz/vikend" },
};

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/vikend */
export default function StrankaBranaVikend({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="vikend" searchParams={searchParams} />;
}
