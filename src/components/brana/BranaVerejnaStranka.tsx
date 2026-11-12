import type { Viewport } from "next";
import { BranaHlavni } from "@/components/brana/BranaHlavni";
import { jeNocniRezimVPraze } from "@/lib/brana/cas";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { branaKonfiguraceVsechPohledu } from "@/lib/brana/pohledy-data";
import { parseBranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import { nactiVerejnouVetuAtmosfery } from "@/lib/brana/atmosfera-verejne";
import { nactiSkrytiAkciNaVikend } from "@/lib/brana/admin/akci-na-vikend-uloziste";
import { nactiSkrytiZameckehoParku } from "@/lib/brana/admin/zamecky-park-uloziste";
import {
  chranitCteniSkrytiAkciNaVikend,
  uplatnitSkrytiAkciNaVikend,
} from "@/lib/brana/sdileni-akci-na-vikend";
import { verejnaVetaZameckehoParku } from "@/lib/brana/zamecky-park";
import {
  nactiVerejnaDataDnesSPoctemAkciNaVikend,
  nactiVerejneSchvalenePohledovaData,
  prazdnaVerejnaPohledovaDataPriChybe,
} from "@/lib/brana/verejne-schvalene-pohledy";

type BranaSearchParams = Promise<{ pozadi?: string }>;

export type BranaPageProps = {
  searchParams: BranaSearchParams;
};

type BranaVerejnaStrankaProps = BranaPageProps & {
  stranka: BranaVerejnaStranka;
};

export async function generateBranaViewport(): Promise<Viewport> {
  return {
    viewportFit: "cover",
    themeColor: "#FAF8F5",
  };
}

export async function BranaVerejnaStranka({
  stranka,
  searchParams,
}: BranaVerejnaStrankaProps) {
  const { pozadi } = await searchParams;
  const okamzik = new Date();
  const vychoziNocRezim = jeNocniRezimVPraze(okamzik);
  let pohledovaData;
  let pocetAkciNaVikend: number | null = null;
  let oknoAkciNaVikend: string | null = null;
  if (stranka === "dnes") {
    const dnes = await nactiVerejnaDataDnesSPoctemAkciNaVikend(okamzik);
    pohledovaData = dnes.ok
      ? dnes.data
      : prazdnaVerejnaPohledovaDataPriChybe(stranka);
    if (dnes.ok && dnes.pocet != null && dnes.pocet > 0) {
      pocetAkciNaVikend = dnes.pocet;
      oknoAkciNaVikend = dnes.oknoIso;
    }
  } else {
    const schvalene = await nactiVerejneSchvalenePohledovaData(stranka);
    pohledovaData = schvalene.ok
      ? schvalene.data
      : prazdnaVerejnaPohledovaDataPriChybe(stranka);
  }
  const konfiguracePohledu = branaKonfiguraceVsechPohledu();
  // Atmosféra jen DNES; fail-soft null = vůbec nerenderovat.
  const atmosferaVeta =
    stranka === "dnes" ? await nactiVerejnouVetuAtmosfery() : null;
  let parkVeta: string | null = null;
  let parkSkrytoDo: string | null = null;
  if (stranka === "dnes") {
    const skryti = await nactiSkrytiZameckehoParku();
    parkSkrytoDo = skryti.stav === "ok" ? skryti.skrytoDo : null;
    parkVeta = verejnaVetaZameckehoParku(okamzik, parkSkrytoDo);
  }
  if (stranka === "dnes") {
    const nacteniSkrytiAkci = await nactiSkrytiAkciNaVikend().then(
      (nacteni) => chranitCteniSkrytiAkciNaVikend(() => nacteni),
      () => ({ stav: "chyba" as const }),
    );
    const poSkryti = uplatnitSkrytiAkciNaVikend(
      okamzik,
      pocetAkciNaVikend,
      oknoAkciNaVikend,
      nacteniSkrytiAkci,
    );
    pocetAkciNaVikend = poSkryti.pocet;
    oknoAkciNaVikend = poSkryti.oknoIso;
  }

  return (
    <BranaHlavni
      stranka={stranka}
      pohledovaData={pohledovaData}
      konfiguracePohledu={konfiguracePohledu}
      variantaPozadi={parseBranaPozadiVarianta(pozadi)}
      vychoziNocRezim={vychoziNocRezim}
      atmosferaVeta={atmosferaVeta}
      parkVeta={parkVeta}
      parkSkrytoDo={parkSkrytoDo}
      pocetAkciNaVikend={pocetAkciNaVikend}
      oknoAkciNaVikend={oknoAkciNaVikend}
    />
  );
}
