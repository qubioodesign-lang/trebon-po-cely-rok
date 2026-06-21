"use client";

import { useState } from "react";
import { sdiletPolozku } from "@/lib/sdileni";
import { useMetriky } from "@/hooks/useMetriky";

interface PropsOdkazSdilet {
  polozkaId: string;
  /** Nad fotografií na mobilu – světlejší, méně kontrastní text */
  nadFotkou?: boolean;
}

const TRIDA_ODKAZ =
  "inline-block text-[0.6875rem] font-light tracking-wide transition-colors duration-300 focus-visible:outline-none";

/** Nenápadný odkaz „sdílet“ – systémové sdílení nebo kopie odkazu do schránky */
export function OdkazSdilet({ polozkaId, nadFotkou = false }: PropsOdkazSdilet) {
  const [potvrzeni, setPotvrzeni] = useState("");
  const { odeslat } = useMetriky();

  const handleSdilet = async () => {
    setPotvrzeni("");
    odeslat("sdileni_fotografie", polozkaId);

    try {
      const vysledek = await sdiletPolozku(polozkaId);
      if (vysledek === "zkopirovano") {
        setPotvrzeni("odkaz zkopírován");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  };

  const tridaTlacitko = nadFotkou
    ? `${TRIDA_ODKAZ} text-white/60 hover:text-white/75 focus-visible:text-white/75`
    : `${TRIDA_ODKAZ} mt-2.5 text-text-velmiJemny/55 hover:text-text-jemny/75 focus-visible:text-text-jemny/75`;

  const tridaPotvrzeni = nadFotkou
    ? "text-[0.625rem] text-white/40"
    : "text-[0.625rem] text-text-velmiJemny/50";

  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={handleSdilet} className={tridaTlacitko}>
        sdílet
      </button>
      {potvrzeni && <p className={`mt-1 ${tridaPotvrzeni}`}>{potvrzeni}</p>}
    </div>
  );
}
