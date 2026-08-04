"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  dalsiZmenaDenniDobyVPraze,
  jeNocniRezimVPraze,
} from "@/lib/brana/cas";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import type {
  BranaKonfiguracePohledu,
  BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { BranaDesktopPozadi } from "./BranaDesktopPozadi";
import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";
import { BranaIosInstalacniVrstva } from "./BranaIosInstalacniVrstva";
import { BranaRegistracePWA } from "./BranaRegistracePWA";
import { BranaVyzvaPlocha } from "./BranaVyzvaPlocha";

type BranaDenniDobaObalProps = {
  vychoziNocRezim: boolean;
  variantaPozadi?: BranaPozadiVarianta;
  stranka?: BranaVerejnaStranka;
  /** Povinné pro veřejný shell pěti pohledů; u vzkazu s children netřeba. */
  pohledovaData?: BranaSdilenaPohledovaData;
  konfiguracePohledu?: BranaKonfiguracePohledu[];
  children?: ReactNode;
  desktopPanel?: ReactNode;
};

function nastavThemeColor(nocRezim: boolean) {
  const barva = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute("content", barva);
  }
}

export function BranaDenniDobaObal({
  stranka = "dnes",
  pohledovaData,
  konfiguracePohledu,
  variantaPozadi,
  vychoziNocRezim,
  children,
  desktopPanel,
}: BranaDenniDobaObalProps) {
  const [nocRezim, setNocRezim] = useState(vychoziNocRezim);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    nastavThemeColor(nocRezim);
  }, [nocRezim]);

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
            {children ??
              (pohledovaData && konfiguracePohledu ? (
                <BranaObrazovka
                  pocatecniPohled={stranka}
                  data={pohledovaData}
                  konfiguracePohledu={konfiguracePohledu}
                />
              ) : null)}
            <BranaVyzvaPlocha nocRezim={nocRezim} />
            <BranaIosInstalacniVrstva nocRezim={nocRezim} />
          </main>
        </div>
        {desktopPanel}
      </div>
    </div>
  );
}
