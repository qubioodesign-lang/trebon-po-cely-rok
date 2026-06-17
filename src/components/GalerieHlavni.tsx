"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PolozkaVerejna } from "@/types";
import { nacistPoziciGalerie, ulozitPoziciGalerie } from "@/lib/uloziste";
import { useMetriky } from "@/hooks/useMetriky";
import { ZobrazeniPolozky } from "./ZobrazeniPolozky";
import { OdkazChciSeVracet } from "./OdkazChciSeVracet";
import { RegistracePWA } from "./RegistracePWA";

interface PropsGalerieHlavni {
  polozky: PolozkaVerejna[];
}

/** Práh tažení pro přepnutí fotografie (v pixelech) */
const PRAH_TAZENI = 50;

/**
 * Hlavní galerie – procházení tažením a šipkami.
 * Jedna fotografie najednou, plynulé přechody.
 */
export function GalerieHlavni({ polozky }: PropsGalerieHlavni) {
  const [aktualniIndex, setAktualniIndex] = useState(0);
  const [jePripraveno, setJePripraveno] = useState(false);
  const [posunX, setPosunX] = useState(0);
  const [jeTazeni, setJeTazeni] = useState(false);

  const zacatekX = useRef(0);
  const { odeslat } = useMetriky();

  // Obnovení pozice po návratu z jiných obrazovek
  useEffect(() => {
    const ulozenaPozice = nacistPoziciGalerie();
    if (ulozenaPozice > 0 && ulozenaPozice < polozky.length) {
      setAktualniIndex(ulozenaPozice);
    }
    setJePripraveno(true);
  }, [polozky.length]);

  // Ukládání pozice při každé změně
  useEffect(() => {
    if (jePripraveno) {
      ulozitPoziciGalerie(aktualniIndex);
    }
  }, [aktualniIndex, jePripraveno]);

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

  return (
    <div className="relative h-dvh min-h-dvh overflow-hidden bg-krem-tmavsi md:h-auto md:min-h-dvh">
      <RegistracePWA />

      {/* Fotografie – na mobilu celý displej, na desktopu 70dvh */}
      <div
        className="relative h-dvh w-full touch-pan-y md:h-[70dvh]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative h-full w-full transition-transform duration-300 ease-klidny"
          style={{
            transform: jeTazeni ? `translateX(${posunX * 0.3}px)` : "translateX(0)",
          }}
        >
          <ZobrazeniPolozky polozka={aktualniPolozka} jeAktivni={true} />

          {/* Název přes fotografií */}
          <div className="absolute inset-x-0 top-0 z-10 px-6 pt-8 md:bg-gradient-to-b md:from-black/30 md:to-transparent md:pb-16">
            <h1 className="text-center text-lg font-light tracking-[0.15em] text-white/90">
              Třeboň po celý rok
            </h1>
          </div>

          {/* Popis a odkaz přes fotografií – pouze mobil */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-6 pb-8 text-center md:hidden">
            <p className="text-sm font-light tracking-wide text-white/90">
              {aktualniPolozka.popis}
            </p>
            <div className="mt-3 [&_.odkaz-jemny]:text-white/75 [&_.odkaz-jemny:hover]:text-white/95 [&_.odkaz-jemny:focus-visible]:text-white/95">
              <OdkazChciSeVracet aktualniIndex={aktualniIndex} />
            </div>
          </div>
        </div>

        {/* Neviditelné oblasti pro kliknutí – šipky na desktopu */}
        <button
          type="button"
          aria-label="Předchozí fotografie"
          onClick={posunZpet}
          className="absolute left-0 top-0 z-10 h-full w-1/4 cursor-pointer opacity-0"
          disabled={aktualniIndex === 0}
        />
        <button
          type="button"
          aria-label="Další fotografie"
          onClick={posunVpred}
          className="absolute right-0 top-0 z-10 h-full w-1/4 cursor-pointer opacity-0"
          disabled={aktualniIndex === polozky.length - 1}
        />
      </div>

      {/* Popis a odkaz pod fotografií – pouze desktop */}
      <div className="hidden flex-col items-center px-6 py-8 text-center md:flex">
        <p className="text-sm font-light tracking-wide text-text-jemny">
          {aktualniPolozka.popis}
        </p>
        <OdkazChciSeVracet aktualniIndex={aktualniIndex} />
      </div>
    </div>
  );
}
