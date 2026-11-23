import type { Metadata } from "next";
import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const metadata: Metadata = {
  title: { absolute: "Třeboň – další akce ve výhledu | BRÁNA" },
  description: "Podívejte se na další schválené akce v Třeboni za nejbližšími sedmi dny.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz/vyhled" },
};

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/vyhled */
export default function StrankaBranaVyhled({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="vyhled" searchParams={searchParams} />;
}
