import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import type {
  BranaKonfiguracePohledu,
  BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { BranaDesktopInformacniPanel } from "./BranaDesktopInformacniPanel";
import { BranaDenniDobaObal } from "./BranaDenniDobaObal";
import { BranaRozpoznaniNavstevy } from "./BranaRozpoznaniNavstevy";

type BranaHlavniProps = {
  stranka?: BranaVerejnaStranka;
  pohledovaData: BranaSdilenaPohledovaData;
  konfiguracePohledu: BranaKonfiguracePohledu[];
  variantaPozadi?: BranaPozadiVarianta;
  vychoziNocRezim: boolean;
  /** Veřejná věta Atmosféry jen pro DNES; null = nerenderovat. */
  atmosferaVeta?: string | null;
  /** Veřejná věta parku jen pro DNES; null = nerenderovat. */
  parkVeta?: string | null;
  /** Konec ručního skrytí parku. */
  parkSkrytoDo?: string | null;
};

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni({
  stranka = "dnes",
  pohledovaData,
  konfiguracePohledu,
  variantaPozadi,
  vychoziNocRezim,
  atmosferaVeta = null,
  parkVeta = null,
  parkSkrytoDo = null,
}: BranaHlavniProps) {
  return (
    <>
      <BranaRozpoznaniNavstevy stranka={stranka} />
      <BranaDenniDobaObal
        stranka={stranka}
        pohledovaData={pohledovaData}
        konfiguracePohledu={konfiguracePohledu}
        variantaPozadi={variantaPozadi}
        vychoziNocRezim={vychoziNocRezim}
        atmosferaVeta={atmosferaVeta}
        parkVeta={parkVeta}
        parkSkrytoDo={parkSkrytoDo}
        desktopPanel={<BranaDesktopInformacniPanel />}
      />
    </>
  );
}
