"use client";

import { useState } from "react";
import { sdiletPolozku } from "@/lib/sdileni";
import { tridyMobilnihoPopisuProlnuti } from "@/lib/popis-radky";
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
  /** Věta nad replay. Stejné sdílení, jiný vzhled. */
  nadReplay?: boolean;
  viditelny?: boolean;
  /** Klepnutí až spolu s replay. Do té doby text jen nabíhá. */
  klikaci?: boolean;
  fadeMs?: number;
}

const TEXT_SDILENI_OKAMZIKU = "Sdílet tento okamžik";

const TRIDA_ODKAZ =
  "inline-block text-[0.6875rem] font-light tracking-wide transition-colors duration-300 focus-visible:outline-none";

/** Nenápadný odkaz „sdílet“ – systémové sdílení nebo kopie odkazu do schránky */
export function OdkazSdilet({
  polozkaId,
  nadFotkou = false,
  nadReplay = false,
  viditelny = false,
  klikaci = false,
  fadeMs = 800,
}: PropsOdkazSdilet) {
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

  if (nadReplay) {
    return (
      <div className="relative">
        {potvrzeni ? (
          <p className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-center text-[0.625rem] text-white/40">
            {potvrzeni}
          </p>
        ) : null}
        <div
          className="relative"
          style={{
            opacity: viditelny ? 1 : 0,
            transition: `opacity ${fadeMs}ms ease-out`,
            pointerEvents: "none",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "16rem",
              height: "4.5rem",
              background:
                "radial-gradient(ellipse 8rem 2.25rem at center, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.65) 30%, rgba(0, 0, 0, 0.35) 62%, rgba(0, 0, 0, 0) 100%)",
            }}
          />
          <button
            type="button"
            onClick={handleSdilet}
            className={`${tridyMobilnihoPopisuProlnuti(TEXT_SDILENI_OKAMZIKU)} relative whitespace-nowrap border-none bg-transparent p-0 outline-none`}
            style={{
              pointerEvents: klikaci ? "auto" : "none",
            }}
            tabIndex={klikaci ? 0 : -1}
            aria-hidden={klikaci ? undefined : true}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-11 -translate-y-1/2"
            />
            {TEXT_SDILENI_OKAMZIKU}
          </button>
        </div>
      </div>
    );
  }

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
