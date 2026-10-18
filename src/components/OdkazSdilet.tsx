"use client";

import { useState } from "react";
import { sdiletPolozku } from "@/lib/sdileni";
import { useMetriky } from "@/hooks/useMetriky";

function IkonaSdileni() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98" />
      <path d="M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

interface PropsOdkazSdilet {
  polozkaId: string;
  /** Mobilní záhlaví – symbol v pravém horním poli */
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

  if (nadFotkou) {
    return (
      <div
        className="fixed z-[25]"
        style={{
          right: "1rem",
          top: "calc(0.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <button
          type="button"
          onClick={handleSdilet}
          aria-label="sdílet"
          className="flex h-11 w-11 items-center justify-center text-white/70 transition-colors duration-300 hover:text-white/95 focus-visible:text-white/95 focus-visible:outline-none"
        >
          <IkonaSdileni />
        </button>
        {potvrzeni && (
          <p className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap text-right text-[0.625rem] text-white/40">
            {potvrzeni}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={handleSdilet}
        className={`${TRIDA_ODKAZ} mt-2.5 text-text-velmiJemny/55 hover:text-text-jemny/75 focus-visible:text-text-jemny/75`}
      >
        sdílet
      </button>
      {potvrzeni && (
        <p className="mt-1 text-[0.625rem] text-text-velmiJemny/50">{potvrzeni}</p>
      )}
    </div>
  );
}
