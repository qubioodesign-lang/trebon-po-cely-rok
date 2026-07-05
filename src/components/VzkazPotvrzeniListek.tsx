"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const POTVRZENI_TEXT = "Vzkaz doputoval";
const MS_ZNAK = 95;
const MS_PAUZA_PRED_SRCEM = 280;
const MS_KRESLENI_SRDC = 720;
const MS_PO_DOKONCENI = 1400;

export const TRIDA_VZKAZ_LISTEK =
  "w-full max-w-[18rem] rotate-[-1.5deg] bg-krem-svetly px-6 py-8 shadow-[0_3px_8px_rgba(47,47,47,0.07),0_14px_36px_rgba(27,58,75,0.12)]";

const INK = "#154a6e";

/** Ručně kreslené srdíčko – jeden tah */
const CESTA_SRDC =
  "M12 18.2c0 0-7.8-4.6-7.8-9.2a4.2 4.2 0 0 1 7.3-2.9L12 7.4l.5-.4A4.2 4.2 0 0 1 19.8 9c0 4.6-7.8 9.2-7.8 9.2z";

interface PropsVzkazPotvrzeniListek {
  onDokonceno: () => void;
}

export function VzkazPotvrzeniListek({ onDokonceno }: PropsVzkazPotvrzeniListek) {
  const [pocetZnaku, setPocetZnaku] = useState(0);
  const [faze, setFaze] = useState<"psani" | "srdce" | "hotovo">("psani");
  const [delkaSrdce, setDelkaSrdce] = useState(0);
  const [offsetSrdce, setOffsetSrdce] = useState(0);
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
  }, [pocetZnaku]);

  useLayoutEffect(() => {
    if (faze !== "srdce" || !pathRef.current) {
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const delka = pathRef.current.getTotalLength();
    setDelkaSrdce(delka);

    if (reducedMotion) {
      setOffsetSrdce(0);
      setFaze("hotovo");
      return;
    }

    setOffsetSrdce(delka);
    const raf = requestAnimationFrame(() => {
      setOffsetSrdce(0);
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
            className="mt-5 h-[1.125rem] w-[1.25rem] shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <path
              ref={pathRef}
              d={CESTA_SRDC}
              stroke={INK}
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: delkaSrdce || undefined,
                strokeDashoffset: offsetSrdce,
                transition:
                  delkaSrdce > 0
                    ? `stroke-dashoffset ${MS_KRESLENI_SRDC}ms ease-out`
                    : undefined,
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
