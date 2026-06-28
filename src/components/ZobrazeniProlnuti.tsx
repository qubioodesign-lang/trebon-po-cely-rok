"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { flushSync } from "react-dom";
import type { PolozkaVerejna } from "@/types";
import {
  ziskatCasOtevreniProlnuti,
  ziskatZbyvajiciCekaniProlnuti,
} from "@/lib/prolnuti-cas-otevreni";
import { zaznamenatDiag } from "@/lib/diag-inicializace";
import {
  PROLNUTI_CEKANI_MS,
  PROLNUTI_DLOUHOTRVANI_MS,
  PROLNUTI_EASING,
  PROLNUTI_ZPOZDENI_SIPKA_MS,
} from "@/lib/prolnuti-konstanty";
import { jePlatnyPocetSnimkuProlnuti } from "@/lib/prolnuti-snimky";
import type { ProlnutiOvladani } from "./SipkaPrehratProlnuti";

interface PropsZobrazeniProlnuti {
  polozka: PolozkaVerejna;
  jeAktivni: boolean;
  onProlnutiOvladani?: (ovladani: ProlnutiOvladani | null) => void;
}

type FazeProlnuti = "cekani" | "prolinuti" | "dokonceno";

function PlaceholderProlnuti({ popis }: { popis: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-krem-tmavsi"
      role="img"
      aria-label={popis || "prolnutí není k dispozici"}
    >
      <p className="px-6 text-center text-xs font-light text-text-velmiJemny">
        prolnutí není k dispozici
      </p>
    </div>
  );
}

function jeSnimekPripraven(img: HTMLImageElement | null | undefined): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

/**
 * Prolnutí – 2–3 fotografie stejného místa.
 * Jednou automaticky, pak zastavení na posledním snímku; opakování jen ručně.
 */
export function ZobrazeniProlnuti({
  polozka,
  jeAktivni,
  onProlnutiOvladani,
}: PropsZobrazeniProlnuti) {
  const urls = polozka.urls ?? [];
  const pocet = urls.length;
  const pocetProlnuti = Math.max(0, pocet - 1);
  const urlsKlic = urls.join("\0");

  const [faze, setFaze] = useState<FazeProlnuti>("cekani");
  const [vrstvaOpacity, setVrstvaOpacity] = useState<number[]>([]);
  const [animujiciKrok, setAnimujiciKrok] = useState<number | null>(null);
  const [zobrazitSipku, setZobrazitSipku] = useState(false);
  const [chyba, setChyba] = useState(false);

  const casovaceRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const behRef = useRef(0);
  const casOtevreniRef = useRef(0);
  const casovacUplynulRef = useRef(false);
  const prolinutiZahajenoRef = useRef(false);
  const probihajiciKrokRef = useRef(0);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const resetVrstev = useCallback((p: number) => {
    setVrstvaOpacity(Array.from({ length: Math.max(0, p - 1) }, () => 1));
  }, []);

  const jsouVsechnySnimkyPripravene = useCallback((): boolean => {
    if (pocet < 2) return false;
    for (let index = 0; index < pocet; index++) {
      if (!jeSnimekPripraven(imgRefs.current[index])) return false;
    }
    return true;
  }, [pocet]);

  const vycistitCasovace = useCallback(() => {
    for (const casovac of casovaceRef.current) {
      clearTimeout(casovac);
    }
    casovaceRef.current = [];
  }, []);

  const naplanovat = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    casovaceRef.current.push(id);
  }, []);

  const spustitKrokProlnuti = useCallback(
    (krok: number, beh: number) => {
      probihajiciKrokRef.current = krok;

      flushSync(() => {
        setAnimujiciKrok(krok);
        setFaze("prolinuti");
      });

      const img = imgRefs.current[krok];
      if (img) {
        void img.offsetHeight;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (behRef.current !== beh) return;
          setVrstvaOpacity((predchozi) => {
            const dalsi = [...predchozi];
            dalsi[krok] = 0;
            return dalsi;
          });
        });
      });

      naplanovat(() => {
        if (behRef.current !== beh) return;

        if (krok < pocetProlnuti - 1) {
          spustitKrokProlnuti(krok + 1, beh);
          return;
        }

        setFaze("dokonceno");
        setAnimujiciKrok(null);
        naplanovat(() => {
          if (behRef.current !== beh) return;
          setZobrazitSipku(true);
        }, PROLNUTI_ZPOZDENI_SIPKA_MS);
      }, PROLNUTI_DLOUHOTRVANI_MS + 80);
    },
    [naplanovat, pocetProlnuti]
  );

  const spustitProlinutiAnimaci = useCallback(() => {
    const beh = behRef.current;

    zaznamenatDiag("prolnutiStart", performance.now() - casOtevreniRef.current);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setVrstvaOpacity(Array.from({ length: pocetProlnuti }, () => 0));
      setFaze("dokonceno");
      naplanovat(() => {
        if (behRef.current !== beh) return;
        setZobrazitSipku(true);
      }, PROLNUTI_ZPOZDENI_SIPKA_MS);
      return;
    }

    spustitKrokProlnuti(0, beh);
  }, [naplanovat, pocetProlnuti, spustitKrokProlnuti]);

  const zkusitSpustitProlinuti = useCallback(() => {
    if (prolinutiZahajenoRef.current) return;
    if (!jeAktivni || pocet < 2) return;
    if (!casovacUplynulRef.current) return;
    if (!jsouVsechnySnimkyPripravene()) return;

    prolinutiZahajenoRef.current = true;
    spustitProlinutiAnimaci();
  }, [jeAktivni, jsouVsechnySnimkyPripravene, pocet, spustitProlinutiAnimaci]);

  const zkusitSpustitProlinutiRef = useRef(zkusitSpustitProlinuti);
  zkusitSpustitProlinutiRef.current = zkusitSpustitProlinuti;

  const naplanovatCekani = useCallback(
    (syncSeStrankou = false) => {
      vycistitCasovace();
      const beh = ++behRef.current;

      casovacUplynulRef.current = false;
      prolinutiZahajenoRef.current = false;
      probihajiciKrokRef.current = 0;

      setZobrazitSipku(false);
      setFaze("cekani");
      setAnimujiciKrok(null);
      resetVrstev(pocet);

      if (!jeAktivni || pocet < 2) return;

      if (syncSeStrankou) {
        casOtevreniRef.current = ziskatCasOtevreniProlnuti();
      } else {
        casOtevreniRef.current = performance.now();
        if (typeof window !== "undefined") {
          window.__TREBON_PROLNUTI_T0 = casOtevreniRef.current;
        }
      }

      const cekaniMs = syncSeStrankou
        ? ziskatZbyvajiciCekaniProlnuti()
        : PROLNUTI_CEKANI_MS;

      naplanovat(() => {
        if (behRef.current !== beh) return;
        casovacUplynulRef.current = true;
        zkusitSpustitProlinutiRef.current();
      }, cekaniMs);
    },
    [jeAktivni, naplanovat, pocet, resetVrstev, vycistitCasovace]
  );

  const naplanovatCekaniRef = useRef(naplanovatCekani);
  naplanovatCekaniRef.current = naplanovatCekani;

  const prehratZnovu = useCallback(() => {
    vycistitCasovace();
    const beh = ++behRef.current;

    flushSync(() => {
      casovacUplynulRef.current = false;
      prolinutiZahajenoRef.current = false;
      probihajiciKrokRef.current = 0;
      setZobrazitSipku(false);
      setFaze("cekani");
      setAnimujiciKrok(null);
      setVrstvaOpacity(Array.from({ length: Math.max(0, pocet - 1) }, () => 1));
    });

    casOtevreniRef.current = performance.now();
    if (typeof window !== "undefined") {
      window.__TREBON_PROLNUTI_T0 = casOtevreniRef.current;
    }

    naplanovat(() => {
      if (behRef.current !== beh) return;
      casovacUplynulRef.current = true;
      zkusitSpustitProlinutiRef.current();
    }, PROLNUTI_CEKANI_MS);
  }, [naplanovat, pocet, vycistitCasovace]);

  useLayoutEffect(() => {
    zaznamenatDiag("prolnuti");
  }, [polozka.id]);

  useEffect(() => {
    onProlnutiOvladani?.({
      zobrazitSipku,
      prehratZnovu,
    });
    return () => onProlnutiOvladani?.(null);
  }, [onProlnutiOvladani, prehratZnovu, zobrazitSipku]);

  useLayoutEffect(() => {
    setChyba(false);
    resetVrstev(pocet);
  }, [polozka.id, pocet, resetVrstev, urlsKlic]);

  useLayoutEffect(() => {
    if (!jeAktivni || !jePlatnyPocetSnimkuProlnuti(pocet)) {
      vycistitCasovace();
      return;
    }

    naplanovatCekaniRef.current(true);

    return () => {
      vycistitCasovace();
    };
  }, [jeAktivni, pocet, polozka.id, urlsKlic, vycistitCasovace]);

  const handleSnimekNacten = useCallback(() => {
    zkusitSpustitProlinutiRef.current();
  }, []);

  const handleKonecProlinuti = (e: TransitionEvent<HTMLImageElement>, index: number) => {
    if (e.propertyName !== "opacity" || faze !== "prolinuti") return;
    if (index !== probihajiciKrokRef.current) return;
  };

  if (!jePlatnyPocetSnimkuProlnuti(pocet) || chyba) {
    return <PlaceholderProlnuti popis={polozka.popis} />;
  }

  const posledniIndex = pocet - 1;

  return (
    <div className="absolute inset-0">
      {urls.map((url, index) => {
        const jePosledni = index === posledniIndex;
        const opacity = jePosledni ? 1 : (vrstvaOpacity[index] ?? 1);
        const skryta =
          faze === "dokonceno" && !jePosledni && opacity === 0;

        const transition =
          faze === "prolinuti" && index === animujiciKrok
            ? `opacity ${PROLNUTI_DLOUHOTRVANI_MS}ms ${PROLNUTI_EASING}`
            : "none";

        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${polozka.id}-${index}`}
            ref={(el) => {
              imgRefs.current[index] = el;
              if (jeSnimekPripraven(el)) {
                queueMicrotask(() => zkusitSpustitProlinutiRef.current());
              }
            }}
            src={url}
            alt={index === 0 ? polozka.popis || "Třeboň" : ""}
            aria-hidden={index !== 0}
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{
              opacity,
              transition,
              zIndex: pocet - index,
              visibility: skryta ? "hidden" : "visible",
            }}
            loading={jeAktivni ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : index === posledniIndex ? "low" : "auto"}
            onLoad={handleSnimekNacten}
            onError={() => setChyba(true)}
            onTransitionEnd={
              !jePosledni ? (e) => handleKonecProlinuti(e, index) : undefined
            }
          />
        );
      })}
    </div>
  );
}
