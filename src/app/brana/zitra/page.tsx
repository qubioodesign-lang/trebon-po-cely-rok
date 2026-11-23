import type { Metadata } from "next";
import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const metadata: Metadata = {
  title: { absolute: "Třeboň zítra – program akcí | BRÁNA" },
  description: "Co se zítra děje v Třeboni? Přehled vybraných akcí a jejich termínů.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz/zitra" },
};

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/zitra */
export default function StrankaBranaZitra({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="zitra" searchParams={searchParams} />;
}
