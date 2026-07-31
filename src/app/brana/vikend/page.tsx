import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/vikend */
export default function StrankaBranaVikend({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="vikend" searchParams={searchParams} />;
}
