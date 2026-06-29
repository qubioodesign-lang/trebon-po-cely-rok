"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import type { PolozkaVerejna, ProlnutiCasovaniNastaveni } from "@/types";
import { zaznamenatDiag } from "@/lib/diag-inicializace";
import {
  jsouGalerieFotkyPripravene,
  odstranitSsrGalerieOkamzite,
  zmizetSsrGalerie,
} from "@/lib/galerie-ssr-prevzeti";
import {
  ziskatPocatecniIndexGalerie,
  ziskatPlatnouPoziciGalerie,
  ulozitPoziciGalerie,
  ulozitPolozkuGalerie,
} from "@/lib/uloziste";
import { useMetriky } from "@/hooks/useMetriky";
import { useAnalytics } from "@/hooks/useAnalytics";
import { LinkaPodPopisem } from "./LinkaPodPopisem";
import { ZobrazeniPolozky } from "./ZobrazeniPolozky";
import { OdkazChciSeVracet } from "./OdkazChciSeVracet";
import { OdkazSdilet } from "./OdkazSdilet";
import { RegistracePWA } from "./RegistracePWA";
import {
  SipkaPrehratProlnuti,
  type ProlnutiOvladani,
} from "./SipkaPrehratProlnuti";

interface PropsGalerieHlavni {
  polozky: PolozkaVerejna[];
  pocatecniPolozkaId?: string;
  /** Index z SSR – pro synchronní převzetí bez bliknutí */
  pocatecniIndex: number;
  prolnutiCasovani: ProlnutiCasovaniNastaveni;
}

/** Práh tažení pro přepnutí fotografie (v pixelech) */
const PRAH_TAZENI = 50;

/** Navigační šipka – stejný vzhled, bez pozadí */
function SipkaNavigace({
  smer,
  onClick,
}: {
  smer: "vlevo" | "vpravo";
  onClick: () => void;
}) {
  const cesta =
    smer === "vlevo" ? "M16 4L6 12L16 20" : "M8 4L18 12L8 20";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={smer === "vlevo" ? "Předchozí fotografie" : "Další fotografie"}
      className="border-none bg-transparent p-2 outline-none -m-2"
    >
      <svg
        className="h-[1.35rem] w-[1.35rem] shrink-0 text-white/75"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={cesta}
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Skok na nejnovější fotografii – |←, vizuálně odlišné od kroku zpět */
function SipkaNavigaceNaZacatek({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nejnovější fotografie"
      className="border-none bg-transparent p-2 outline-none -m-2"
    >
      <svg
        className="h-[1.35rem] w-[1.625rem] shrink-0 text-white/75"
        viewBox="0 0 20 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4V20"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M16 4L7 12L16 20"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Hlavní galerie – procházení tažením a šipkami.
 * Jedna fotografie najednou, plynulé přechody.
 */
export function GalerieHlavni({
  polozky,
  pocatecniPolozkaId,
  pocatecniIndex,
  prolnutiCasovani,
}: PropsGalerieHlavni) {
  const galerieDiagRef = useRef(false);
  const ssrPrevzatoRef = useRef(false);
  const fotoKontejnerRef = useRef<HTMLDivElement>(null);
  const [ssrAktivni, setSsrAktivni] = useState(false);

  useLayoutEffect(() => {
    if (galerieDiagRef.current) return;
    galerieDiagRef.current = true;
    zaznamenatDiag("galerie");
    setSsrAktivni(Boolean(document.getElementById("trebon-ssr-galerie")));
  }, []);

  const dokoncitPrevzetiSsr = useCallback(() => {
    if (ssrPrevzatoRef.current) return;
    ssrPrevzatoRef.current = true;
    zmizetSsrGalerie(() => setSsrAktivni(false));
  }, []);

  const zrusitSsrGalerie = useCallback(() => {
    if (ssrPrevzatoRef.current) return;
    ssrPrevzatoRef.current = true;
    odstranitSsrGalerieOkamzite();
    setSsrAktivni(false);
  }, []);

  const [aktualniIndex, setAktualniIndex] = useState(() =>
    ziskatPocatecniIndexGalerie(polozky, pocatecniPolozkaId)
  );
  const [jePripraveno, setJePripraveno] = useState(false);
  const [posunX, setPosunX] = useState(0);
  const [jeTazeni, setJeTazeni] = useState(false);
  const [prolnutiOvladani, setProlnutiOvladani] =
    useState<ProlnutiOvladani | null>(null);

  const zacatekX = useRef(0);
  const aktualniIndexRef = useRef(aktualniIndex);
  const { odeslat } = useMetriky();
  useAnalytics();

  aktualniIndexRef.current = aktualniIndex;

  // Obnovení pozice po návratu (odkaz, systémové Zpět, gesto na iPhonu)
  useEffect(() => {
    const obnovitPozici = () => {
      const index = pocatecniPolozkaId
        ? ziskatPocatecniIndexGalerie(polozky, pocatecniPolozkaId)
        : ziskatPlatnouPoziciGalerie(polozky.length);
      setAktualniIndex((predchozi) =>
        predchozi === index ? predchozi : index
      );
    };

    obnovitPozici();
    setJePripraveno(true);

    window.addEventListener("pageshow", obnovitPozici);
    const priViditelnosti = () => {
      if (document.visibilityState === "visible") obnovitPozici();
    };
    document.addEventListener("visibilitychange", priViditelnosti);

    return () => {
      window.removeEventListener("pageshow", obnovitPozici);
      document.removeEventListener("visibilitychange", priViditelnosti);
    };
  }, [polozky, pocatecniPolozkaId]);

  // Převzetí SSR → klient: klient pod SSR, fade až po načtení fotek
  useEffect(() => {
    if (!ssrAktivni || !jePripraveno) return;

    if (aktualniIndex !== pocatecniIndex) {
      zrusitSsrGalerie();
      return;
    }

    const zkusitPrevzeti = () => {
      if (ssrPrevzatoRef.current) return;
      if (!jsouGalerieFotkyPripravene(fotoKontejnerRef.current)) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => dokoncitPrevzetiSsr());
      });
    };

    zkusitPrevzeti();

    const kontejner = fotoKontejnerRef.current;
    if (!kontejner) return;

    kontejner.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", zkusitPrevzeti);
      img.addEventListener("error", zkusitPrevzeti);
    });

    return () => {
      kontejner.querySelectorAll("img").forEach((img) => {
        img.removeEventListener("load", zkusitPrevzeti);
        img.removeEventListener("error", zkusitPrevzeti);
      });
    };
  }, [
    aktualniIndex,
    dokoncitPrevzetiSsr,
    jePripraveno,
    pocatecniIndex,
    ssrAktivni,
    zrusitSsrGalerie,
  ]);

  // Ukládání pozice a ID položky při každé změně
  useEffect(() => {
    if (jePripraveno && polozky[aktualniIndex]) {
      ulozitPoziciGalerie(aktualniIndex);
      ulozitPolozkuGalerie(polozky[aktualniIndex].id);
    }
  }, [aktualniIndex, jePripraveno, polozky]);

  // Poslední jistota při odchodu z galerie
  useEffect(() => {
    return () => {
      ulozitPoziciGalerie(aktualniIndexRef.current);
    };
  }, []);

  // Záznam zobrazení fotografie
  useEffect(() => {
    if (jePripraveno && polozky[aktualniIndex]) {
      odeslat("zobrazeni_fotografie", polozky[aktualniIndex].id);
    }
  }, [aktualniIndex, jePripraveno, polozky, odeslat]);

  const posunVpred = useCallback(() => {
    if (aktualniIndex < polozky.length - 1) {
      setAktualniIndex((i) => i + 1);
      odeslat("posun_vpred", polozky[aktualniIndex]?.id);
    }
  }, [aktualniIndex, polozky, odeslat]);

  const posunZpet = useCallback(() => {
    if (aktualniIndex > 0) {
      setAktualniIndex((i) => i - 1);
      odeslat("navrat_zpet", polozky[aktualniIndex]?.id);
    }
  }, [aktualniIndex, polozky, odeslat]);

  const skokNaNejnovejsi = useCallback(() => {
    setAktualniIndex((index) => (index > 0 ? 0 : index));
  }, []);

  const handleReplayProlnuti = useCallback(() => {
    if (!prolnutiOvladani) return;
    const polozkaId = polozky[aktualniIndex]?.id;
    if (!polozkaId) return;
    odeslat("replay_prolnuti", polozkaId);
    prolnutiOvladani.prehratZnovu();
  }, [aktualniIndex, odeslat, polozky, prolnutiOvladani]);

  // Klávesové ovládání šipkami
  useEffect(() => {
    const handleKlavesa = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") posunVpred();
      if (e.key === "ArrowLeft") posunZpet();
    };
    window.addEventListener("keydown", handleKlavesa);
    return () => window.removeEventListener("keydown", handleKlavesa);
  }, [posunVpred, posunZpet]);

  // Dotykové ovládání – tažení prstem
  const handleTouchStart = (e: React.TouchEvent) => {
    zacatekX.current = e.touches[0].clientX;
    setJeTazeni(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!jeTazeni) return;
    const rozdil = e.touches[0].clientX - zacatekX.current;
    setPosunX(rozdil);
  };

  const handleTouchEnd = () => {
    if (posunX < -PRAH_TAZENI) posunVpred();
    else if (posunX > PRAH_TAZENI) posunZpet();
    setPosunX(0);
    setJeTazeni(false);
  };

  // Mobil: zákaz vertikálního scrollování – jedna obrazovka bez posunu
  useEffect(() => {
    if (polozky.length === 0) return;

    const jeMobil = () => window.matchMedia("(max-width: 767px)").matches;

    const zamknoutScroll = () => {
      if (!jeMobil()) return;
      document.documentElement.classList.add("galerie-bez-scrollu");
      document.body.classList.add("galerie-bez-scrollu");
    };

    const odemknoutScroll = () => {
      document.documentElement.classList.remove("galerie-bez-scrollu");
      document.body.classList.remove("galerie-bez-scrollu");
    };

    zamknoutScroll();
    window.addEventListener("resize", zamknoutScroll);

    return () => {
      window.removeEventListener("resize", zamknoutScroll);
      odemknoutScroll();
    };
  }, [polozky.length]);

  const aktualniPolozkaId = polozky[aktualniIndex]?.id;

  useEffect(() => {
    setProlnutiOvladani(null);
  }, [aktualniPolozkaId]);

  if (polozky.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-krem px-6 text-center">
        <RegistracePWA />
        <h1 className="mb-4 text-xl font-light tracking-wide text-text">
          Třeboň po celý rok
        </h1>
        <p className="text-sm text-text-jemny">
          brzy zde přibude první fotografie
        </p>
      </div>
    );
  }

  const aktualniPolozka = polozky[aktualniIndex];
  const jeProlnuti = aktualniPolozka.typ === "prolnuti";

  return (
    <div
      className={`fixed inset-0 z-0 h-dvh max-h-dvh w-full overflow-hidden overscroll-none bg-krem-tmavsi md:static md:z-auto md:h-auto md:max-h-none md:min-h-dvh${ssrAktivni ? " pointer-events-none" : ""}`}
      aria-hidden={ssrAktivni ? true : undefined}
    >
      <RegistracePWA />

      {/* Fotografie – na mobilu celý displej, na desktopu 70dvh */}
      <div
        className="relative h-full w-full touch-none md:h-[70dvh] md:touch-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative isolate h-full w-full transition-transform duration-300 ease-klidny"
          style={{
            transform: jeTazeni ? `translateX(${posunX * 0.3}px)` : "translateX(0)",
          }}
        >
          {/* Fotografie – nejnižší vrstva */}
          <div ref={fotoKontejnerRef} className="absolute inset-0 z-0">
            <ZobrazeniPolozky
              polozka={aktualniPolozka}
              jeAktivni={true}
              casovani={prolnutiCasovani}
              onProlnutiOvladani={jeProlnuti ? setProlnutiOvladani : undefined}
            />
          </div>

          {/* DOČASNĚ výrazné gradienty pro ověření viditelnosti – pouze mobil, nad fotografií (z-8) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[8] h-40 md:hidden"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0) 100%)",
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-52 md:hidden"
            style={{
              background:
                "linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Šipka replay prolnutí – střed obrazovky, lehce pod geometrickým středem */}
          {jeProlnuti && prolnutiOvladani && (
            <div className="pointer-events-none absolute inset-x-0 top-[57%] z-[15] flex -translate-y-1/2 justify-center">
              <div className="pointer-events-auto">
                <SipkaPrehratProlnuti
                  viditelna={prolnutiOvladani.zobrazitSipku}
                  onClick={handleReplayProlnuti}
                  fadeMs={prolnutiCasovani.replayFadeMs}
                />
              </div>
            </div>
          )}

          {/* Název přes fotografií – nad gradientem (z-20) */}
          <div className="absolute inset-x-0 top-0 z-20 px-6 pt-8 md:bg-gradient-to-b md:from-black/30 md:to-transparent md:pb-16">
            <h1 className="text-center text-lg font-light tracking-[0.15em] text-white/90">
              Třeboň po celý rok
            </h1>
          </div>

          {/* Popis a odkaz přes fotografií – pouze mobil, nad gradientem (z-20) */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-[calc(2.75rem+env(safe-area-inset-bottom,0px))] text-center md:hidden">
            <p className="text-sm font-light tracking-wide text-white/90">
              {aktualniPolozka.popis}
            </p>
            <div className="relative my-3 flex w-full items-center justify-center">
              {aktualniIndex >= 1 && (
                <div className="absolute left-[2%] top-1/2 -translate-y-1/2">
                  <SipkaNavigaceNaZacatek onClick={skokNaNejnovejsi} />
                </div>
              )}
              {aktualniIndex > 0 && (
                <div className="absolute left-[14%] top-1/2 -translate-y-1/2">
                  <SipkaNavigace smer="vlevo" onClick={posunZpet} />
                </div>
              )}
              <LinkaPodPopisem />
              {aktualniIndex < polozky.length - 1 && (
                <div className="absolute right-[5%] top-1/2 -translate-y-1/2">
                  <SipkaNavigace smer="vpravo" onClick={posunVpred} />
                </div>
              )}
            </div>
            <div className="[&_.odkaz-jemny]:text-white/75 [&_.odkaz-jemny:hover]:text-white/95 [&_.odkaz-jemny:focus-visible]:text-white/95">
              <OdkazChciSeVracet
                aktualniIndex={aktualniIndex}
                polozkaId={aktualniPolozka.id}
              />
            </div>
          </div>

          {/* sdílet – absolutně ve spodním paddingu, neovlivňuje overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc((2.75rem+env(safe-area-inset-bottom,0px))/2-0.6875rem)] z-20 flex justify-center md:hidden">
            <div className="pointer-events-auto -translate-y-1/2">
              <OdkazSdilet polozkaId={aktualniPolozka.id} nadFotkou />
            </div>
          </div>
        </div>

        {/* Neviditelné oblasti pro kliknutí – šipky na desktopu */}
        <button
          type="button"
          aria-label="Předchozí fotografie"
          onClick={posunZpet}
          className="absolute left-0 top-0 z-10 h-full w-1/4 cursor-pointer opacity-0 pointer-events-none md:pointer-events-auto"
          disabled={aktualniIndex === 0}
        />
        <button
          type="button"
          aria-label="Další fotografie"
          onClick={posunVpred}
          className="absolute right-0 top-0 z-10 h-full w-1/4 cursor-pointer opacity-0 pointer-events-none md:pointer-events-auto"
          disabled={aktualniIndex === polozky.length - 1}
        />
      </div>

      {/* Popis a odkaz pod fotografií – pouze desktop */}
      <div className="hidden flex-col items-center px-6 py-8 text-center md:flex">
        <p className="text-sm font-light tracking-wide text-text-jemny">
          {aktualniPolozka.popis}
        </p>
        <OdkazChciSeVracet
          aktualniIndex={aktualniIndex}
          polozkaId={aktualniPolozka.id}
        />
        <OdkazSdilet polozkaId={aktualniPolozka.id} />
      </div>
    </div>
  );
}
