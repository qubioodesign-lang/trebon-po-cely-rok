"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  dalsiZmenaDenniDobyVPraze,
  jeNocniRezimVPraze,
} from "@/lib/brana/cas";
import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { opakovaniSeznamuAkci } from "@/lib/brana/navigace-stranky";
import type {
  BranaKonfiguracePohledu,
  BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { BranaDesktopPozadi } from "./BranaDesktopPozadi";
import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";
import { BranaFacebookInstalacniVrstva } from "./BranaFacebookInstalacniVrstva";
import { BranaIosInstalacniVrstva } from "./BranaIosInstalacniVrstva";
import { BranaRegistracePWA } from "./BranaRegistracePWA";
import { BranaVyzvaPlocha } from "./BranaVyzvaPlocha";

/** Dokumentový theme-color = krémový PWA status bar (tmavé systémové ikony). */
const BRANA_STATUS_BAR_THEME = "#FAF8F5";

type BranaDenniDobaObalProps = {
  vychoziNocRezim: boolean;
  variantaPozadi?: BranaPozadiVarianta;
  stranka?: BranaVerejnaStranka;
  pohledovaData?: BranaSdilenaPohledovaData;
  konfiguracePohledu?: BranaKonfiguracePohledu[];
  atmosferaVeta?: string | null;
  parkVeta?: string | null;
  parkSkrytoDo?: string | null;
  pocetAkciNaVikend?: number | null;
  oknoAkciNaVikend?: string | null;
  jsouTrhyAkciNaVikend?: boolean | null;
  vychoziViditelneAkciNaVikend?: boolean;
  children?: ReactNode;
  desktopPanel?: ReactNode;
};

function nastavThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute("content", BRANA_STATUS_BAR_THEME);
  }
}

export function BranaDenniDobaObal({
  stranka = "dnes",
  pohledovaData,
  konfiguracePohledu,
  variantaPozadi,
  vychoziNocRezim,
  atmosferaVeta = null,
  parkVeta = null,
  parkSkrytoDo = null,
  pocetAkciNaVikend = null,
  oknoAkciNaVikend = null,
  jsouTrhyAkciNaVikend = null,
  vychoziViditelneAkciNaVikend = false,
  children,
  desktopPanel,
}: BranaDenniDobaObalProps) {
  const [nocRezim, setNocRezim] = useState(vychoziNocRezim);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    nastavThemeColor();
  }, []);

  useEffect(() => {
    setNocRezim(jeNocniRezimVPraze());

    const naplanuj = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const dalsi = dalsiZmenaDenniDobyVPraze();
      const prodleva = Math.max(dalsi.getTime() - Date.now(), 0) + 50;

      timeoutRef.current = setTimeout(() => {
        setNocRezim(jeNocniRezimVPraze());
        naplanuj();
      }, prodleva);
    };

    naplanuj();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const verejnaTrida = nocRezim ? "brana-verejna--noc" : "brana-verejna--den";

  return (
    <div className="brana-desktop-kontejner">
      <BranaRegistracePWA />
      <BranaDesktopPozadi nocRezim={nocRezim} />
      <div className="brana-desktop-radek">
        <div className="brana-desktop-mobil">
          <BranaPozadi varianta={variantaPozadi} nocRezim={nocRezim} />
          <main
            className={`relative z-[1] flex min-h-dvh flex-1 flex-col ${verejnaTrida}`}
          >
            {children ?? (
              <BranaObrazovka
                aktivniStranka={stranka}
                opakovaniSeznamu={
                  konfiguracePohledu?.find((polozka) => polozka.id === stranka)
                    ?.opakovaniSeznamu ?? opakovaniSeznamuAkci(stranka)
                }
                data={pohledovaData}
                konfiguracePohledu={konfiguracePohledu}
                atmosferaVeta={atmosferaVeta}
                parkVeta={parkVeta}
                parkSkrytoDo={parkSkrytoDo}
                pocetAkciNaVikend={pocetAkciNaVikend}
                oknoAkciNaVikend={oknoAkciNaVikend}
                jsouTrhyAkciNaVikend={jsouTrhyAkciNaVikend}
                vychoziViditelneAkciNaVikend={vychoziViditelneAkciNaVikend}
              />
            )}
            <BranaVyzvaPlocha nocRezim={nocRezim} />
            <BranaIosInstalacniVrstva nocRezim={nocRezim} />
            <BranaFacebookInstalacniVrstva nocRezim={nocRezim} />
          </main>
        </div>
        {desktopPanel}
      </div>
    </div>
  );
}
