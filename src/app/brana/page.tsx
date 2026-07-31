import {
  BranaVerejnaStranka,
  generateBranaViewport,
  type BranaPageProps,
} from "@/components/brana/BranaVerejnaStranka";

export const generateViewport = generateBranaViewport;

/** Kořenová stránka projektu Brána – /brana (Dnes) */
export default function StrankaBrana({ searchParams }: BranaPageProps) {
  return <BranaVerejnaStranka stranka="dnes" searchParams={searchParams} />;
}
