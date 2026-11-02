"use client";

import { useEffect, useState } from "react";
import {
  priZmeneFacebookInstalacniVrstvy,
  zavritFacebookInstalacniVrstvu,
  ziskatFacebookInstalacniVrstvu,
} from "@/lib/brana/facebook-instalacni-vrstva";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import {
  aktualniStrankaUrl,
  sestavitFacebookOtevreniVChromu,
} from "@/lib/brana/otevrit-v-chromu";

type BranaFacebookInstalacniVrstvaProps = {
  nocRezim: boolean;
};

export function BranaFacebookInstalacniVrstva({
  nocRezim,
}: BranaFacebookInstalacniVrstvaProps) {
  const [otevreno, setOtevreno] = useState(
    () => ziskatFacebookInstalacniVrstvu().otevreno,
  );

  useEffect(() => {
    return priZmeneFacebookInstalacniVrstvy(() => {
      setOtevreno(ziskatFacebookInstalacniVrstvu().otevreno);
    });
  }, []);

  if (!otevreno) {
    return null;
  }

  const odkaz = sestavitFacebookOtevreniVChromu(aktualniStrankaUrl());
  const barvaPozadi = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: barvaPozadi, color: "#ffffff" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brana-facebook-chrome-nadpis"
    >
      <button
        type="button"
        onClick={zavritFacebookInstalacniVrstvu}
        className="absolute right-6 border-0 bg-transparent p-0 text-sm tracking-wide text-white/70"
        style={{ top: "calc(2rem + env(safe-area-inset-top, 0px))" }}
        aria-label="Zavřít"
      >
        zavřít
      </button>

      <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-20">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p
            id="brana-facebook-chrome-nadpis"
            className="text-[0.8rem] font-normal leading-[1.2]"
          >
            V Chromu pak ještě jednou zvolte Přidat BRÁNU na plochu.
          </p>
          {odkaz ? (
            <a
              href={odkaz}
              className="inline-block rounded-sm border border-white/70 px-8 py-3.5 text-[0.9rem] font-semibold leading-[1.75rem] tracking-wide text-white no-underline"
            >
              Otevřít v Chromu
            </a>
          ) : null}
          <p className="text-[0.8rem] font-normal leading-[1.2]">
            Facebook se zeptá, zda chcete otevřít externí aplikaci. Potvrďte{" "}
            <strong className="font-bold">Pokračovat</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
