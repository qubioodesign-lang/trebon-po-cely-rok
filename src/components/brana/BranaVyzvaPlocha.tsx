"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import {
  jeBranaSpustenaJakoPwa,
  priAppInstalled,
  vyvolatInstalacniDialogSDiagnostikou,
  type BranaInstalacniDiagnostikaStav,
} from "@/lib/brana/pwa-instalace";
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

function zmerTopVyzvyPlochy(): number | null {
  const linka = document.querySelector(".brana-orientacni-oddelovac");
  const kotva = document.querySelector(".brana-casova-kotva");

  if (!linka || !kotva) {
    return null;
  }

  const linkaRect = linka.getBoundingClientRect();
  const kotvaRect = kotva.getBoundingClientRect();
  const kotvaStyles = getComputedStyle(kotva);
  const paddingTop = Number.parseFloat(kotvaStyles.paddingTop);
  const paddingBottom = Number.parseFloat(kotvaStyles.paddingBottom);

  const datumTextTop = kotvaRect.top + paddingTop;
  const datumTextBottom = kotvaRect.bottom - paddingBottom;
  const mezeraLinkaDatum = datumTextTop - linkaRect.bottom;

  return datumTextBottom + mezeraLinkaDatum;
}

export function BranaVyzvaPlocha({ nocRezim }: BranaVyzvaPlochaProps) {
  const [viditelna, setViditelna] = useState(false);
  const [pripravena, setPripravena] = useState(false);
  const [topPx, setTopPx] = useState<number | null>(null);
  const [beziJakoPwa, setBeziJakoPwa] = useState(false);
  const [diagnostickyStav, setDiagnostickyStav] =
    useState<BranaInstalacniDiagnostikaStav | null>(null);

  const skrytVyzvu = useCallback(() => {
    setViditelna(false);
    setPripravena(false);
  }, []);

  const aktualizujPozici = useCallback(() => {
    const top = zmerTopVyzvyPlochy();

    if (top !== null) {
      setTopPx(top);
    }
  }, []);

  const zobraz = useCallback(() => {
    oznacVyzvuPlochyZobrazenou();
    setViditelna(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, []);

  useEffect(() => {
    if (jeBranaSpustenaJakoPwa()) {
      setBeziJakoPwa(true);
      return;
    }

    if (jeVyzvaPlochyZavrena()) {
      return;
    }

    if (bylaVyzvaPlochyZobrazena()) {
      setViditelna(true);
      setPripravena(true);
      return;
    }

    const prodleva = zbyvajiciProdlevaVyzvyPlochy();
    const timeout = window.setTimeout(zobraz, prodleva);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [zobraz]);

  useEffect(() => {
    if (!viditelna || beziJakoPwa) {
      return;
    }

    aktualizujPozici();
    window.addEventListener("resize", aktualizujPozici);

    return () => {
      window.removeEventListener("resize", aktualizujPozici);
    };
  }, [aktualizujPozici, beziJakoPwa, viditelna]);

  useLayoutEffect(() => {
    if (!viditelna || beziJakoPwa) {
      return;
    }

    aktualizujPozici();
  }, [aktualizujPozici, beziJakoPwa, viditelna]);

  useEffect(() => {
    if (beziJakoPwa) {
      return;
    }

    return priAppInstalled(() => {
      zavritVyzvuPlochy();
      skrytVyzvu();
    });
  }, [beziJakoPwa, skrytVyzvu]);

  const zavrit = (udalost: MouseEvent<HTMLButtonElement>) => {
    udalost.stopPropagation();
    zavritVyzvuPlochy();
    skrytVyzvu();
  };

  const hlavniKlik = useCallback(() => {
    setDiagnostickyStav("handler spuštěn");
    void vyvolatInstalacniDialogSDiagnostikou(setDiagnostickyStav).then(
      (vysledek) => {
        if (vysledek === "instalace přijata") {
          zavritVyzvuPlochy();
          skrytVyzvu();
        }
      },
    );
  }, [skrytVyzvu]);

  const hlavniKlavesa = (udalost: KeyboardEvent<HTMLDivElement>) => {
    if (udalost.key === "Enter" || udalost.key === " ") {
      udalost.preventDefault();
      hlavniKlik();
    }
  };

  if (beziJakoPwa || !viditelna || jeVyzvaPlochyZavrena()) {
    return null;
  }

  const podklad = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const stylObalu: CSSProperties | undefined =
    topPx !== null ? { top: `${topPx}px` } : undefined;

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={stylObalu}
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
        role="button"
        tabIndex={0}
        aria-label="Přidat BRÁNU na plochu"
        onClick={hlavniKlik}
        onKeyDown={hlavniKlavesa}
      >
        <button
          type="button"
          className="brana-vyzva-plocha-zavrit"
          aria-label="Zavřít"
          onClick={zavrit}
        >
          <span aria-hidden>×</span>
        </button>
        <div className="brana-vyzva-plocha-hlavni">
          <span className="brana-vyzva-plocha-text">
            Přidat{" "}
            <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na plochu
          </span>
          <span className="brana-vyzva-plocha-sipka" aria-hidden>
            →
          </span>
        </div>
      </div>
      {diagnostickyStav ? (
        <p className="brana-vyzva-plocha-diagnostika" aria-live="polite">
          {diagnostickyStav}
        </p>
      ) : null}
    </div>
  );
}
