import type { Metadata } from "next";
import { BranaInformaceStranka } from "@/components/brana/informace/BranaInformaceStranka";
import { generateBranaViewport } from "@/components/brana/BranaVerejnaStranka";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "O BRÁNĚ do Třeboně" },
  description:
    "Seznamte se s BRÁNOU do Třeboně, jejími zdroji informací a možností kontaktu.",
  alternates: { canonical: "https://brana.trebonpocelyrok.cz/informace" },
};

export const generateViewport = generateBranaViewport;

/** Informační stránka BRÁNY – /brana/informace */
export default function StrankaBranaInformace() {
  const vychoziNocRezim = jeNocniRezimVPraze();

  return <BranaInformaceStranka vychoziNocRezim={vychoziNocRezim} />;
}
