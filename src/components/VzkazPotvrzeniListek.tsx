"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const POTVRZENI_TEXT = "Vzkaz doputoval";

/** Prázdný lístek – krátké očekávání před psaním */
const MS_PRAZDNY_LISTEK = 600;
/** Celá věta cca 2,2–3,0 s */
const MS_CELKEM_PSANI = 2_600;
const MS_ZNAK = Math.ceil(MS_CELKEM_PSANI / POTVRZENI_TEXT.length);
/** Pauza mezi textem a srdcem */
const MS_PAUZA_PRED_SRCEM = 400;
/** Kreslení srdíčka jedním tahem */
const MS_KRESLENI_SRDC = 1_250;
/** Klid po dokreslení před zavřením */
const MS_PO_DOKONCENI = 1_500;

export const TRIDA_VZKAZ_LISTEK =
  "w-full max-w-[18rem] rotate-[-1.5deg] bg-krem-svetly px-6 py-8 shadow-[0_3px_8px_rgba(47,47,47,0.07),0_14px_36px_rgba(27,58,75,0.12)]";

const INK = "#154a6e";

/** Ručně kreslené srdíčko – jeden tah */
const CESTA_SRDC =
  "M12 18.2c0 0-7.8-4.6-7.8-9.2a4.2 4.2 0 0 1 7.3-2.9L12 7.4l.5-.4A4.2 4.2 0 0 1 19.8 9c0 4.6-7.8 9.2-7.8 9.2z";

type FazePotvrzeni = "ceka" | "psani" | "srdce" | "hotovo";

interface PropsVzkazPotvrzeniListek {
  onDokonceno: () => void;
}

export function VzkazPotvrzeniListek({ onDokonceno }: PropsVzkazPotvrzeniListek) {
  const [faze, setFaze] = useState<FazePotvrzeni>("ceka");
  const [pocetZnaku, setPocetZnaku] = useState(0);
  const [delkaSrdce, setDelkaSrdce] = useState(0);
  const [offsetSrdce, setOffsetSrdce] = useState(0);
  const [srdceAnimuje, setSrdceAnimuje] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const onDokoncenoRef = useRef(onDokonceno);
  onDokoncenoRef.current = onDokonceno;

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setPocetZnaku(POTVRZENI_TEXT.length);
      setFaze("srdce");
      return;
    }

    if (faze === "ceka") {
      const casovac = window.setTimeout(() => setFaze("psani"), MS_PRAZDNY_LISTEK);
      return () => window.clearTimeout(casovac);
    }

    if (faze !== "psani") {
      return;
    }

    if (pocetZnaku >= POTVRZENI_TEXT.length) {
      const casovac = window.setTimeout(
        () => setFaze("srdce"),
        MS_PAUZA_PRED_SRCEM
      );
      return () => window.clearTimeout(casovac);
    }

    const casovac = window.setTimeout(
      () => setPocetZnaku((predchozi) => predchozi + 1),
      MS_ZNAK
    );
    return () => window.clearTimeout(casovac);
  }, [faze, pocetZnaku]);

  useLayoutEffect(() => {
    if (faze !== "srdce" || !pathRef.current) {
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const delka = pathRef.current.getTotalLength();
    setDelkaSrdce(delka);
    setSrdceAnimuje(false);

    if (reducedMotion) {
      setOffsetSrdce(0);
      setFaze("hotovo");
      return;
    }

    setOffsetSrdce(delka);
    void pathRef.current.getBoundingClientRect();

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSrdceAnimuje(true);
        setOffsetSrdce(0);
      });
    });

    const casovac = window.setTimeout(() => setFaze("hotovo"), MS_KRESLENI_SRDC);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(casovac);
    };
  }, [faze]);

  useEffect(() => {
    if (faze !== "hotovo") {
      return;
    }

    const casovac = window.setTimeout(
      () => onDokoncenoRef.current(),
      MS_PO_DOKONCENI
    );
    return () => window.clearTimeout(casovac);
  }, [faze]);

  const zobrazenyText = POTVRZENI_TEXT.slice(0, pocetZnaku);

  return (
    <div className={TRIDA_VZKAZ_LISTEK}>
      <div
        className="vzkaz-listek flex min-h-[9rem] flex-col items-center justify-center text-center text-xl leading-relaxed"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="whitespace-pre-wrap">{zobrazenyText || "\u00a0"}</p>
        {(faze === "srdce" || faze === "hotovo") && (
          <svg
            viewBox="0 0 24 22"
            className="mt-5 h-[1.45rem] w-[1.6rem] shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <path
              ref={pathRef}
              d={CESTA_SRDC}
              stroke={INK}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: delkaSrdce || undefined,
                strokeDashoffset: offsetSrdce,
                transition: srdceAnimuje
                  ? `stroke-dashoffset ${MS_KRESLENI_SRDC}ms cubic-bezier(0.38, 0, 0.22, 1)`
                  : "none",
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
