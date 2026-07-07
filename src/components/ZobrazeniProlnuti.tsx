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
import { PROLNUTI_EASING, PROLNUTI_EASING_FADEOUT_DRUHE } from "@/lib/prolnuti-konstanty";
import type { ProlnutiCasovaniNastaveni } from "@/lib/prolnuti-casovani";
import {
  jePlatnyPocetSnimkuProlnuti,
  pocetKrokuProlnuti,
} from "@/lib/prolnuti-snimky";
import { ziskatUrlsProlnuti } from "@/lib/polozka-soubory";
import type { ProlnutiOvladani } from "./SipkaPrehratProlnuti";

interface PropsZobrazeniProlnuti {
  polozka: PolozkaVerejna;
  jeAktivni: boolean;
  casovani: ProlnutiCasovaniNastaveni;
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

function prodlevaDoDalsihoKrokuMs(
  casovani: ProlnutiCasovaniNastaveni,
  pocetSnimku: number,
  krok: number
): number {
  if (pocetSnimku >= 3 && krok === 0) {
    return casovani.prodlevaPredPoslednimKrokemMs;
  }

  return Math.max(
    80,
    casovani.delkaProlnutiMs + 80 - casovani.prekrytiProlnutiMs
  );
}

/** Počáteční opacity vrstev – u 3 fotek je poslední snímek skrytý (0) */
function vytvoritVychoziOpacity(pocetSnimku: number): number[] {
  return Array.from({ length: pocetSnimku }, (_, index) =>
    pocetSnimku >= 3 && index === pocetSnimku - 1 ? 0 : 1
  );
}

function jePosledniKrokProlnuti(pocetSnimku: number, krok: number): boolean {
  return pocetSnimku >= 3 && krok === pocetSnimku - 2;
}

/**
 * Prolnutí – 2–3 fotografie stejného místa.
 * Jednou automaticky, pak zastavení na posledním snímku; opakování jen ručně.
 */
export function ZobrazeniProlnuti({
  polozka,
  jeAktivni,
  casovani,
  onProlnutiOvladani,
}: PropsZobrazeniProlnuti) {
  const urls = ziskatUrlsProlnuti(polozka);
  const pocet = urls.length;
  const pocetProlnuti = pocetKrokuProlnuti(pocet);
  const urlsKlic = urls.join("\0");

  const [faze, setFaze] = useState<FazeProlnuti>("cekani");
  const [vrstvaOpacity, setVrstvaOpacity] = useState<number[]>([]);
  const [aktivniFadeKroky, setAktivniFadeKroky] = useState<Set<number>>(
    () => new Set()
  );
  const [zobrazitSipku, setZobrazitSipku] = useState(false);
  const [chyba, setChyba] = useState(false);
  const [behProlnuti, setBehProlnuti] = useState(0);

  const casovaceRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const behRef = useRef(0);
  const casOtevreniRef = useRef(0);
  const casovacUplynulRef = useRef(false);
  const prolinutiZahajenoRef = useRef(false);
  const probihajiciKrokRef = useRef(0);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const resetVrstev = useCallback((p: number) => {
    setVrstvaOpacity(vytvoritVychoziOpacity(p));
  }, []);

  const vynulovatAktivniFade = useCallback(() => {
    setAktivniFadeKroky(new Set());
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
        setAktivniFadeKroky((predchozi) => {
          const dalsi = new Set(predchozi).add(krok);
          if (jePosledniKrokProlnuti(pocet, krok)) {
            dalsi.add(pocet - 1);
          }
          return dalsi;
        });
        setFaze("prolinuti");
        if (krok === 0) {
          setBehProlnuti((predchozi) => predchozi + 1);
        }
      });

      const img = imgRefs.current[krok];
      if (img) {
        void img.offsetHeight;
      }

      if (jePosledniKrokProlnuti(pocet, krok)) {
        const posledni = imgRefs.current[pocet - 1];
        if (posledni) {
          void posledni.offsetHeight;
        }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (behRef.current !== beh) return;
          setVrstvaOpacity((predchozi) => {
            const dalsi = [...predchozi];
            dalsi[krok] = 0;
            if (jePosledniKrokProlnuti(pocet, krok)) {
              dalsi[pocet - 1] = 1;
            }
            return dalsi;
          });
        });
      });

      naplanovat(() => {
        if (behRef.current !== beh) return;

        if (krok < pocetProlnuti - 1) {
          spustitKrokProlnutiRef.current(krok + 1, beh);
          return;
        }

        setFaze("dokonceno");
        naplanovat(() => {
          if (behRef.current !== beh) return;
          setZobrazitSipku(true);
        }, casovani.replayZpozdeniMs);
      }, prodlevaDoDalsihoKrokuMs(casovani, pocet, krok));
    },
    [casovani, naplanovat, pocet, pocetProlnuti]
  );

  const spustitKrokProlnutiRef = useRef(spustitKrokProlnuti);
  spustitKrokProlnutiRef.current = spustitKrokProlnuti;

  const spustitProlinutiAnimaci = useCallback(() => {
    const beh = behRef.current;

    zaznamenatDiag("prolnutiStart", performance.now() - casOtevreniRef.current);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setVrstvaOpacity(
        Array.from({ length: pocet }, (_, index) => (index === pocet - 1 ? 1 : 0))
      );
      setFaze("dokonceno");
      naplanovat(() => {
        if (behRef.current !== beh) return;
        setZobrazitSipku(true);
      }, casovani.replayZpozdeniMs);
      return;
    }

    spustitKrokProlnuti(0, beh);
  }, [casovani.replayZpozdeniMs, naplanovat, pocet, spustitKrokProlnuti]);

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
      vynulovatAktivniFade();
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
        ? ziskatZbyvajiciCekaniProlnuti(casovani.cekaniPredStartemMs)
        : casovani.cekaniPredStartemMs;

      naplanovat(() => {
        if (behRef.current !== beh) return;
        casovacUplynulRef.current = true;
        zkusitSpustitProlinutiRef.current();
      }, cekaniMs);
    },
    [casovani.cekaniPredStartemMs, jeAktivni, naplanovat, pocet, resetVrstev, vycistitCasovace, vynulovatAktivniFade]
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
      vynulovatAktivniFade();
      setVrstvaOpacity(vytvoritVychoziOpacity(pocet));
    });

    casOtevreniRef.current = performance.now();
    if (typeof window !== "undefined") {
      window.__TREBON_PROLNUTI_T0 = casOtevreniRef.current;
    }

    naplanovat(() => {
      if (behRef.current !== beh) return;
      casovacUplynulRef.current = true;
      zkusitSpustitProlinutiRef.current();
    }, casovani.cekaniPredStartemMs);
  }, [casovani.cekaniPredStartemMs, naplanovat, pocet, vycistitCasovace, vynulovatAktivniFade]);

  useLayoutEffect(() => {
    zaznamenatDiag("prolnuti");
  }, [polozka.id]);

  useEffect(() => {
    onProlnutiOvladani?.({
      zobrazitSipku,
      prehratZnovu,
      faze,
      behProlnuti,
    });
    return () => onProlnutiOvladani?.(null);
  }, [onProlnutiOvladani, prehratZnovu, zobrazitSipku, faze, behProlnuti]);

  useLayoutEffect(() => {
    setChyba(false);
    resetVrstev(pocet);
    vynulovatAktivniFade();
  }, [polozka.id, pocet, resetVrstev, urlsKlic, vynulovatAktivniFade]);

  useLayoutEffect(() => {
    if (!jeAktivni || !jePlatnyPocetSnimkuProlnuti(pocet)) {
      vycistitCasovace();
      vynulovatAktivniFade();
      return;
    }

    naplanovatCekaniRef.current(true);

    return () => {
      vycistitCasovace();
    };
  }, [jeAktivni, pocet, polozka.id, urlsKlic, vycistitCasovace, vynulovatAktivniFade]);

  const handleSnimekNacten = useCallback(() => {
    zkusitSpustitProlinutiRef.current();
  }, []);

  const handleKonecProlinuti = useCallback(
    (e: TransitionEvent<HTMLImageElement>, index: number) => {
      if (e.propertyName !== "opacity") {
        return;
      }

      setAktivniFadeKroky((predchozi) => {
        if (!predchozi.has(index)) {
          return predchozi;
        }

        const dalsi = new Set(predchozi);
        dalsi.delete(index);
        return dalsi;
      });
    },
    []
  );

  if (!jePlatnyPocetSnimkuProlnuti(pocet) || chyba) {
    return <PlaceholderProlnuti popis={polozka.popis} />;
  }

  const posledniIndex = pocet - 1;

  return (
    <div className="absolute inset-0">
      {urls.map((url, index) => {
        const jePosledni = index === posledniIndex;
        const opacity = jePosledni
          ? pocet >= 3
            ? (vrstvaOpacity[index] ?? 0)
            : 1
          : (vrstvaOpacity[index] ?? 1);
        const skryta =
          faze === "dokonceno" && !jePosledni && opacity === 0;

        const delkaFadeMs =
          jePosledni && pocet >= 3
            ? casovani.nastupPoslednihoSnimkuMs
            : casovani.delkaProlnutiMs;

        const jeFadeOutDruheVPoslednimKroku =
          pocet >= 3 && index === 1 && aktivniFadeKroky.has(posledniIndex);

        const easing = jeFadeOutDruheVPoslednimKroku
          ? PROLNUTI_EASING_FADEOUT_DRUHE
          : PROLNUTI_EASING;

        const transition = aktivniFadeKroky.has(index)
          ? `opacity ${delkaFadeMs}ms ${easing}`
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
              !jePosledni || pocet >= 3
                ? (e) => handleKonecProlinuti(e, index)
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
