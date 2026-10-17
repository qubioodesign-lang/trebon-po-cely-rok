"use client";

import { BRANA_ANALYTIKA_PRIJEM_ZAPNUT } from "@/lib/brana/analytika/model";
import { obslouzitStiskSdileni } from "@/lib/brana/analytika/sdileni-klik";
import { sdiletBrana } from "@/lib/brana/sdileni";
import { BranaIkonaSdileni } from "./BranaIkony";

/** Tlačítko sdílení v hlavičce BRÁNY – nativní Web Share API */
export function BranaTlacitkoSdileni() {
  const handleSdilet = () =>
    obslouzitStiskSdileni({
      prijima: BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
      sdilet: () => sdiletBrana(),
      zaznamenat: () => {
        if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT) {
          return;
        }
        return import("@/lib/brana/analytika/napojeni-navstevy").then((modul) =>
          modul.zaznamenatKlikSdileniVOkne(),
        );
      },
    });

  return (
    <button
      type="button"
      onClick={() => void handleSdilet()}
      className="flex h-full w-full items-center justify-center text-white"
      aria-label="Sdílet"
    >
      <BranaIkonaSdileni />
    </button>
  );
}
