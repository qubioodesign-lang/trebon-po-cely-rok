import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/vyhled */
export default function StrankaBranaVyhled({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="vyhled" searchParams={searchParams} />;
}
