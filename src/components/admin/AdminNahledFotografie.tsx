"use client";

import { useEffect } from "react";
import type { Polozka } from "@/types";
import { mapovatPolozkuVerejnou } from "@/lib/polozka-soubory";
import { maViceRadkuPopisu } from "@/lib/popis-radky";

interface PropsAdminNahledFotografie {
  polozka: Polozka;
  onZavrit: () => void;
}

/** Stejný rámeček jako náhled prolnutí. Viewport Honoru 70, šířka 320 px. */
const REFERENCNI_SIRKA_NAHLEDU_PX = 320;
const POMER_SIRKA = 390;
const POMER_VYSKA = 844;
const VIDITELNA_SIRKA = `min(${REFERENCNI_SIRKA_NAHLEDU_PX}px, calc(100vw - 2rem), calc((100dvh - 4.5rem) * ${POMER_SIRKA} / ${POMER_VYSKA}))`;
const MERITKO = `min(1, calc((100vw - 2rem) / ${REFERENCNI_SIRKA_NAHLEDU_PX}px), calc((100dvh - 4.5rem) / (${REFERENCNI_SIRKA_NAHLEDU_PX}px * ${POMER_VYSKA} / ${POMER_SIRKA})))`;

/** Stejné třídy jako mobilní popis fotografie v galerii. Galerie se nemění. */
function tridyMobilnihoPopisuFotografie(popis: string): string {
  const zaklad = "text-sm font-light tracking-wide text-white/90";
  if (!maViceRadkuPopisu(popis)) {
    return zaklad;
  }
  return `${zaklad} max-w-[240px] whitespace-pre leading-[1.625]`;
}

/**
 * Náhled jedné uložené fotografie v administraci.
 * Stejný ořez jako veřejná galerie, bez replay, statistik a odkazů.
 * Viditelnost položky se nekontroluje — skrytá fotografie se dá prohlédnout.
 */
export function AdminNahledFotografie({
  polozka,
  onZavrit,
}: PropsAdminNahledFotografie) {
  useEffect(() => {
    const zavritKlavesou = (event: KeyboardEvent) => {
      if (event.key === "Escape") onZavrit();
    };
    window.addEventListener("keydown", zavritKlavesou);
    return () => window.removeEventListener("keydown", zavritKlavesou);
  }, [onZavrit]);

  if (polozka.typ !== "fotografie" || !polozka.soubor) {
    return null;
  }

  const verejna = mapovatPolozkuVerejnou(polozka);
  if (!verejna.url) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Náhled fotografie"
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={verejna.url}
                alt={verejna.popis || "Třeboň"}
                className="absolute inset-0 h-full w-full object-cover"
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-[calc(2.75rem+env(safe-area-inset-bottom,0px))] text-center">
              <p className={tridyMobilnihoPopisuFotografie(verejna.popis)}>
                {verejna.popis}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
