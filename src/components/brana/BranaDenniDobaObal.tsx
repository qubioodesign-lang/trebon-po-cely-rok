"use client";

import { useEffect, useRef, useState } from "react";
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
import { opakovaniSeznamuAkci } from "@/lib/brana/navigace-stranky";
import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";

type BranaDenniDobaObalProps = {
  stranka: BranaVerejnaStranka;
  variantaPozadi?: BranaPozadiVarianta;
  vychoziNocRezim: boolean;
};

function nastavThemeColor(nocRezim: boolean) {
  const barva = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute("content", barva);
  }
}

export function BranaDenniDobaObal({
  stranka,
  variantaPozadi,
  vychoziNocRezim,
}: BranaDenniDobaObalProps) {
  const [nocRezim, setNocRezim] = useState(vychoziNocRezim);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    nastavThemeColor(nocRezim);
  }, [nocRezim]);

  useEffect(() => {
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
