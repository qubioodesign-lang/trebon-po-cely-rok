import { BranaInformaceStranka } from "@/components/brana/informace/BranaInformaceStranka";
import { generateBranaViewport } from "@/components/brana/BranaVerejnaStranka";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";

export const dynamic = "force-dynamic";

export const generateViewport = generateBranaViewport;

/** Informační stránka BRÁNY – /brana/informace */
export default function StrankaBranaInformace() {
  const vychoziNocRezim = jeNocniRezimVPraze();

  return <BranaInformaceStranka vychoziNocRezim={vychoziNocRezim} />;
}
