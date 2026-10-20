"use client";

import { useEffect, useRef, useState } from "react";
import type { Polozka, ProlnutiCasovaniNastaveni } from "@/types";
import { mapovatPolozkuVerejnou } from "@/lib/polozka-soubory";
import {
  stylMobilnihoPopisuProlnuti,
  tridyMobilnihoPopisuProlnuti,
} from "@/lib/popis-radky";
import { ZobrazeniProlnuti } from "@/components/ZobrazeniProlnuti";
import {
  SipkaPrehratProlnuti,
  type ProlnutiOvladani,
} from "@/components/SipkaPrehratProlnuti";

interface PropsAdminNahledProlnuti {
  polozka: Polozka;
  casovani: ProlnutiCasovaniNastaveni;
  onZavrit: () => void;
}

/** Viewport Honoru 70. Text má uvnitř px-6 sloupec 272 px. */
const REFERENCNI_SIRKA_NAHLEDU_PX = 320;
const POMER_SIRKA = 390;
const POMER_VYSKA = 844;
const VIDITELNA_SIRKA = `min(${REFERENCNI_SIRKA_NAHLEDU_PX}px, calc(100vw - 2rem), calc((100dvh - 4.5rem) * ${POMER_SIRKA} / ${POMER_VYSKA}))`;
const MERITKO = `min(1, calc((100vw - 2rem) / ${REFERENCNI_SIRKA_NAHLEDU_PX}px), calc((100dvh - 4.5rem) / (${REFERENCNI_SIRKA_NAHLEDU_PX}px * ${POMER_VYSKA} / ${POMER_SIRKA})))`;

/**
 * Náhled jednoho prolnutí v administraci.
 * Stejná animace jako na webu, bez statistik a bez veřejné galerie.
 */
export function AdminNahledProlnuti({
  polozka,
  casovani,
  onZavrit,
}: PropsAdminNahledProlnuti) {
  const [ovladani, setOvladani] = useState<ProlnutiOvladani | null>(null);
  const startRef = useRef<string | null>(null);
  const verejna = mapovatPolozkuVerejnou(polozka);
  const startKlic = `${verejna.id}\0${(verejna.urls ?? []).join("\0")}`;

  if (typeof window !== "undefined" && startRef.current !== startKlic) {
    startRef.current = startKlic;
    window.__TREBON_PROLNUTI_T0 = performance.now();
  }

  useEffect(() => {
    const zavritKlavesou = (event: KeyboardEvent) => {
      if (event.key === "Escape") onZavrit();
    };
    window.addEventListener("keydown", zavritKlavesou);
    return () => window.removeEventListener("keydown", zavritKlavesou);
  }, [onZavrit]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Náhled prolnutí"
      onClick={onZavrit}
    >
      <div
        className="flex max-h-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onZavrit}
          className="text-xs text-white/85"
        >
          zavřít
        </button>

        <div
          className="relative overflow-hidden"
          style={{
            width: VIDITELNA_SIRKA,
            aspectRatio: `${POMER_SIRKA} / ${POMER_VYSKA}`,
          }}
        >
          <div
            className="absolute left-0 top-0 overflow-hidden bg-krem-tmavsi"
            style={{
              width: REFERENCNI_SIRKA_NAHLEDU_PX,
              height: `calc(${REFERENCNI_SIRKA_NAHLEDU_PX}px * ${POMER_VYSKA} / ${POMER_SIRKA})`,
              transform: `scale(${MERITKO})`,
              transformOrigin: "top left",
            }}
          >
            <div className="absolute inset-0">
              <ZobrazeniProlnuti
                polozka={verejna}
                jeAktivni
                casovani={casovani}
                onProlnutiOvladani={setOvladani}
              />
            </div>

            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-52"
              style={{
                background:
                  "linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0) 100%)",
              }}
              aria-hidden="true"
            />

            {ovladani && (
              <div className="pointer-events-none absolute inset-x-0 top-[57%] z-[15] flex -translate-y-1/2 justify-center">
                <div className="pointer-events-auto">
                  <SipkaPrehratProlnuti
                    viditelna={ovladani.zobrazitSipku}
                    onClick={ovladani.prehratZnovu}
                    fadeMs={casovani.replayFadeMs}
                  />
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-[calc(2.75rem+env(safe-area-inset-bottom,0px))] text-center">
              <p
                className={tridyMobilnihoPopisuProlnuti(verejna.popis)}
                style={stylMobilnihoPopisuProlnuti(verejna.popis)}
              >
                {verejna.popis}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
