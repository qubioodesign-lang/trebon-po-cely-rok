import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const generateViewport = generateBranaViewport;

/** Veřejná stránka Brány – /brana/7-dni */
export default function StrankaBrana7Dni({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="7-dni" searchParams={searchParams} />;
}
