"use client";

import { useState } from "react";
import { sdiletPolozku } from "@/lib/sdileni";

interface PropsOdkazSdilet {
  polozkaId: string;
  potvrzeniClassName?: string;
}

/** Nenápadný odkaz „sdílet“ – systémové sdílení nebo kopie odkazu do schránky */
export function OdkazSdilet({
  polozkaId,
  potvrzeniClassName = "text-xs text-text-velmiJemny",
}: PropsOdkazSdilet) {
  const [potvrzeni, setPotvrzeni] = useState("");

  const handleSdilet = async () => {
    setPotvrzeni("");

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

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleSdilet}
        className="odkaz-jemny inline-block"
      >
        sdílet
      </button>
      {potvrzeni && <p className={potvrzeniClassName}>{potvrzeni}</p>}
    </div>
  );
}
