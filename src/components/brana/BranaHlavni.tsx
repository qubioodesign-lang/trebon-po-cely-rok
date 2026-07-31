import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { opakovaniSeznamuAkci } from "@/lib/brana/navigace-stranky";
import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";

type BranaHlavniProps = {
  stranka?: BranaVerejnaStranka;
  variantaPozadi?: BranaPozadiVarianta;
  nocRezim?: boolean;
};

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni({
  stranka = "dnes",
  variantaPozadi,
  nocRezim,
}: BranaHlavniProps) {
  const verejnaTrida = nocRezim ? "brana-verejna--noc" : "brana-verejna--den";

  return (
    <>
      <BranaPozadi varianta={variantaPozadi} nocRezim={nocRezim} />
      <main
        className={`relative z-[1] flex min-h-dvh flex-1 flex-col ${verejnaTrida}`}
      >
        <BranaObrazovka
          aktivniStranka={stranka}
          opakovaniSeznamu={opakovaniSeznamuAkci(stranka)}
        />
      </main>
    </>
  );
}
