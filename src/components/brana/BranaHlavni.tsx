import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import type {
  BranaKonfiguracePohledu,
  BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { BranaDesktopInformacniPanel } from "./BranaDesktopInformacniPanel";
import { BranaDenniDobaObal } from "./BranaDenniDobaObal";

type BranaHlavniProps = {
  stranka?: BranaVerejnaStranka;
  pohledovaData: BranaSdilenaPohledovaData;
  konfiguracePohledu: BranaKonfiguracePohledu[];
  variantaPozadi?: BranaPozadiVarianta;
  vychoziNocRezim: boolean;
  /** Veřejná věta Atmosféry jen pro DNES; null = nerenderovat. */
  atmosferaVeta?: string | null;
};

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni({
  stranka = "dnes",
  pohledovaData,
  konfiguracePohledu,
  variantaPozadi,
  vychoziNocRezim,
  atmosferaVeta = null,
}: BranaHlavniProps) {
  return (
    <BranaDenniDobaObal
      stranka={stranka}
      pohledovaData={pohledovaData}
      konfiguracePohledu={konfiguracePohledu}
      variantaPozadi={variantaPozadi}
      vychoziNocRezim={vychoziNocRezim}
      atmosferaVeta={atmosferaVeta}
      desktopPanel={<BranaDesktopInformacniPanel />}
    />
  );
}
