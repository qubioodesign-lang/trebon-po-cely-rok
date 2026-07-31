import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/zitra */
export default function StrankaBranaZitra({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="zitra" searchParams={searchParams} />;
}
