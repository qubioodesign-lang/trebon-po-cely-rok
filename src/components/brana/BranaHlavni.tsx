import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { BranaDesktopInformacniPanel } from "./BranaDesktopInformacniPanel";
import { BranaDenniDobaObal } from "./BranaDenniDobaObal";

type BranaHlavniProps = {
  stranka?: BranaVerejnaStranka;
  variantaPozadi?: BranaPozadiVarianta;
  vychoziNocRezim: boolean;
};

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni({
  stranka = "dnes",
  variantaPozadi,
  vychoziNocRezim,
}: BranaHlavniProps) {
  return (
    <BranaDenniDobaObal
      stranka={stranka}
      variantaPozadi={variantaPozadi}
      vychoziNocRezim={vychoziNocRezim}
      desktopPanel={<BranaDesktopInformacniPanel />}
    />
  );
}
