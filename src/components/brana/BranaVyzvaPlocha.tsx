"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import {
  jeBranaSpustenaJakoPwa,
  jeInstalacniPromptKDispozici,
  priZmeneInstalacnihoPromptu,
  vyvolatInstalacniDialog,
  zachytitInstalacniPrompt,
  zahoditInstalacniPrompt,
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
  const [casUplynul, setCasUplynul] = useState(false);
  const [promptKDispozici, setPromptKDispozici] = useState(false);
  const [beziJakoPwa, setBeziJakoPwa] = useState(false);

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
    aktualizujPozici();
    oznacVyzvuPlochyZobrazenou();
    setViditelna(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, [aktualizujPozici]);

  useEffect(() => {
    if (jeBranaSpustenaJakoPwa()) {
      setBeziJakoPwa(true);
      return;
    }

    aktualizujPozici();
    window.addEventListener("resize", aktualizujPozici);

    const onBeforeInstallPrompt = (udalost: Event) => {
      zachytitInstalacniPrompt(udalost);
    };

    const onAppInstalled = () => {
      zahoditInstalacniPrompt();
      zavritVyzvuPlochy();
      skrytVyzvu();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    setPromptKDispozici(jeInstalacniPromptKDispozici());

    let timeout: number | undefined;

    if (
      bylaVyzvaPlochyZobrazena() &&
      jeInstalacniPromptKDispozici() &&
      !jeVyzvaPlochyZavrena()
    ) {
      setCasUplynul(true);
      setViditelna(true);
      setPripravena(true);
    } else if (!jeVyzvaPlochyZavrena()) {
      const prodleva = zbyvajiciProdlevaVyzvyPlochy();
      timeout = window.setTimeout(() => {
        setCasUplynul(true);
      }, prodleva);
    }

    const odregistrovatPrompt = priZmeneInstalacnihoPromptu(() => {
      setPromptKDispozici(jeInstalacniPromptKDispozici());
    });

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }

      window.removeEventListener("resize", aktualizujPozici);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      odregistrovatPrompt();
    };
  }, [aktualizujPozici, skrytVyzvu]);

  useEffect(() => {
    if (
      beziJakoPwa ||
      jeVyzvaPlochyZavrena() ||
      !casUplynul ||
      !promptKDispozici ||
      viditelna
    ) {
      return;
    }

    zobraz();
  }, [beziJakoPwa, casUplynul, promptKDispozici, viditelna, zobraz]);

  const zavrit = (udalost: MouseEvent<HTMLButtonElement>) => {
    udalost.stopPropagation();
    zavritVyzvuPlochy();
    skrytVyzvu();
  };

  const hlavniKlik = async () => {
    const vysledek = await vyvolatInstalacniDialog();
    setPromptKDispozici(false);

    if (vysledek === "nedostupny") {
      return;
    }

    zavritVyzvuPlochy();
    skrytVyzvu();
  };

  if (
    beziJakoPwa ||
    !viditelna ||
    topPx === null ||
    jeVyzvaPlochyZavrena() ||
    !promptKDispozici
  ) {
    return null;
  }

  const podklad = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={{ top: `${topPx}px` }}
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
        <button
          type="button"
          className="brana-vyzva-plocha-hlavni"
          aria-label="Přidat BRÁNU na plochu"
          onClick={hlavniKlik}
        >
          <span className="brana-vyzva-plocha-text">
            Přidat{" "}
            <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na plochu
          </span>
          <span className="brana-vyzva-plocha-sipka" aria-hidden>
            →
          </span>
        </button>
      </div>
    </div>
  );
}
