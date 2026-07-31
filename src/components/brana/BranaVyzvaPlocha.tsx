"use client";

import { useCallback, useEffect, useState } from "react";
import { BRANA_PWA_DEN_BARVA } from "@/lib/brana/konstanty";
import {
  bylaVyzvaPlochyZobrazena,
  jeVyzvaPlochyZavrena,
  oznacVyzvuPlochyZobrazenou,
  zavritVyzvuPlochy,
  zbyvajiciProdlevaVyzvyPlochy,
} from "@/lib/brana/vyzva-plocha";

type BranaVyzvaPlochaProps = {
  nocRezim: boolean;
};

function zmerTopPodDatem(): number | null {
  const datum = document.querySelector(".brana-datum");

  if (!datum) {
    return null;
  }

  return datum.getBoundingClientRect().bottom;
}

export function BranaVyzvaPlocha({ nocRezim: _nocRezim }: BranaVyzvaPlochaProps) {
  const [viditelna, setViditelna] = useState(false);
  const [pripravena, setPripravena] = useState(false);
  const [topPx, setTopPx] = useState<number | null>(null);

  const aktualizujPozici = useCallback(() => {
    const top = zmerTopPodDatem();

    if (top !== null) {
      setTopPx(top);
    }
  }, []);

  const zobraz = useCallback(() => {
    aktualizujPozici();
    oznacVyzvuPlochyZobrazenou();
    setViditelna(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, [aktualizujPozici]);

  useEffect(() => {
    if (jeVyzvaPlochyZavrena()) {
      return;
    }

    aktualizujPozici();
    window.addEventListener("resize", aktualizujPozici);

    if (bylaVyzvaPlochyZobrazena()) {
      setViditelna(true);
      setPripravena(true);

      return () => {
        window.removeEventListener("resize", aktualizujPozici);
      };
    }

    const prodleva = zbyvajiciProdlevaVyzvyPlochy();
    const timeout = window.setTimeout(zobraz, prodleva);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", aktualizujPozici);
    };
  }, [aktualizujPozici, zobraz]);

  const zavrit = () => {
    zavritVyzvuPlochy();
    setViditelna(false);
    setPripravena(false);
  };

  if (!viditelna || topPx === null || jeVyzvaPlochyZavrena()) {
    return null;
  }

  const podklad = BRANA_PWA_DEN_BARVA;

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={{ top: `calc(${topPx}px + 0.25rem)` }}
      role="region"
      aria-label="Přidat BRÁNU na plochu"
    >
      <div
        className={
          pripravena
            ? "brana-vyzva-plocha brana-vyzva-plocha--viditelna"
            : "brana-vyzva-plocha"
        }
        style={{ backgroundColor: podklad }}
      >
        <button
          type="button"
          className="brana-vyzva-plocha-zavrit"
          aria-label="Zavřít"
          onClick={zavrit}
        >
          <span aria-hidden>×</span>
        </button>
        <p className="brana-vyzva-plocha-text">
          Přidat{" "}
          <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na plochu
        </p>
        <span className="brana-vyzva-plocha-sipka" aria-hidden>
          →
        </span>
      </div>
    </div>
  );
}
