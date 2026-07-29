import { BranaHlavni } from "@/components/brana/BranaHlavni";
import { parseBranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";

/** Kořenová stránka projektu Brána – /brana */
export default async function StrankaBrana({
  searchParams,
}: {
  searchParams: Promise<{ pozadi?: string }>;
}) {
  const { pozadi } = await searchParams;
  const variantaPozadi = parseBranaPozadiVarianta(pozadi);

  return <BranaHlavni variantaPozadi={variantaPozadi} />;
}
