import type { Metadata } from "next";
import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const metadata: Metadata = {
  title: { absolute: "Třeboň – akce na 7 dní od zítřka | BRÁNA" },
  description: "Přehled vybraných akcí v Třeboni na sedm dní od zítřka.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz/7-dni" },
};

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/7-dni */
export default function StrankaBrana7Dni({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="7-dni" searchParams={searchParams} />;
}
