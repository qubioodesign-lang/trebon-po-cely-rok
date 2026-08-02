import { BranaVzkazStranka } from "@/components/brana/vzkaz/BranaVzkazStranka";
import { generateBranaViewport } from "@/components/brana/BranaVerejnaStranka";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";

export const dynamic = "force-dynamic";

export const generateViewport = generateBranaViewport;

/** Stránka pro psaní vzkazu BRÁNĚ – /brana/vzkaz */
export default function StrankaBranaVzkaz() {
  const vychoziNocRezim = jeNocniRezimVPraze();

  return <BranaVzkazStranka vychoziNocRezim={vychoziNocRezim} />;
}
