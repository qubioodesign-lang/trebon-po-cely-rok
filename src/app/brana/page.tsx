import { BranaHlavni } from "@/components/brana/BranaHlavni";
import {
  parseBranaNocRezim,
  parseBranaPozadiVarianta,
} from "@/lib/brana/pozadi-varianty";

/** Kořenová stránka projektu Brána – /brana */
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
