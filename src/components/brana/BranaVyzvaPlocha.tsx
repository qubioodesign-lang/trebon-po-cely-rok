"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  aktualniStrankaUrl,
  BRANA_TEKST_OTEVRIT_V_CHROMU,
  pripravitOtevreniVChromu,
} from "@/lib/brana/otevrit-v-chromu";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import {
  otevritBranaIosInstalacniObrazovku,
  urcitBranaCestuPoKliknuti,
  urcitBranaVyzvaViditelnost,
} from "@/lib/brana/pwa-instalacni-stav";
import {
  jeBranaSpustenaJakoPwa,
  priAppInstalled,
  priZmeneInstalacnihoPromptu,
  vyvolatInstalacniDialog,
} from "@/lib/brana/pwa-instalace";
import {
  vymazatEmbeddedAndroidKontext,
  vycistitEmbeddedPoInstalaci,
  zapamatovatEmbeddedAndroidKontext,
  zpracovatOtevreniVChromu,
} from "@/lib/brana/vlozeny-android-prohlizec";
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
  const [prodlevaUplynula, setProdlevaUplynula] = useState(
    () => bylaVyzvaPlochyZobrazena(),
  );
  const [pripravena, setPripravena] = useState(() =>
    bylaVyzvaPlochyZobrazena(),
  );
  const [topPx, setTopPx] = useState<number | null>(null);
  const [prepoctiVerze, setPrepoctiVerze] = useState(0);

  const obnovitStav = useCallback(() => {
    setPrepoctiVerze((verze) => verze + 1);
  }, []);

  const vstup = useMemo(
    () => ({
      vyzvaZavrena: jeVyzvaPlochyZavrena(),
      nainstalovano: jeBranaSpustenaJakoPwa(),
      prodlevaUplynula,
      aktualniUrl: aktualniStrankaUrl(),
    }),
    [prepoctiVerze, prodlevaUplynula],
  );

  const viditelnost = useMemo(
    () => urcitBranaVyzvaViditelnost(vstup),
    [vstup],
  );

  const cesta = useMemo(() => {
    if (!viditelnost.viditelna) {
      return { typ: "ZATIM_NEDOSTUPNA" as const };
    }

    return urcitBranaCestuPoKliknuti(vstup);
  }, [viditelnost, vstup]);

  const skrytVyzvu = useCallback(() => {
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
    setProdlevaUplynula(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, []);

  useEffect(() => {
    const praveOtevrenoVChromu = zpracovatOtevreniVChromu();
    if (!praveOtevrenoVChromu) {
      zapamatovatEmbeddedAndroidKontext();
    }

    if (jeBranaSpustenaJakoPwa()) {
      vycistitEmbeddedPoInstalaci();
    }

    obnovitStav();

    return priZmeneInstalacnihoPromptu(() => {
      obnovitStav();
    });
  }, [obnovitStav]);

  useEffect(() => {
    if (jeBranaSpustenaJakoPwa()) {
      return;
    }

    if (jeVyzvaPlochyZavrena()) {
      return;
    }

    if (bylaVyzvaPlochyZobrazena()) {
      setProdlevaUplynula(true);
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
    if (!viditelnost.viditelna) {
      return;
    }

    aktualizujPozici();
    window.addEventListener("resize", aktualizujPozici);

    return () => {
      window.removeEventListener("resize", aktualizujPozici);
    };
  }, [aktualizujPozici, viditelnost.viditelna]);

  useLayoutEffect(() => {
    if (!viditelnost.viditelna) {
      return;
    }

    aktualizujPozici();
  }, [aktualizujPozici, viditelnost.viditelna]);

  useEffect(() => {
    return priAppInstalled(() => {
      vycistitEmbeddedPoInstalaci();
      zavritVyzvuPlochy();
      skrytVyzvu();
      obnovitStav();
    });
  }, [obnovitStav, skrytVyzvu]);

  const zavrit = (udalost: MouseEvent<HTMLButtonElement>) => {
    udalost.stopPropagation();
    udalost.preventDefault();
    zavritVyzvuPlochy();
    skrytVyzvu();
    obnovitStav();
  };

  const hlavniKlik = useCallback(async () => {
    if (cesta.typ === "PROMPT") {
      const vysledek = await vyvolatInstalacniDialog();

      if (vysledek === "accepted") {
        zavritVyzvuPlochy();
        skrytVyzvu();
      }

      obnovitStav();
      return;
    }

    if (cesta.typ === "IOS_INSTALACE") {
      otevritBranaIosInstalacniObrazovku(cesta.varianta);
    }
  }, [cesta, obnovitStav, skrytVyzvu]);

  const otevritVChromu = (udalost: MouseEvent<HTMLAnchorElement>) => {
    vymazatEmbeddedAndroidKontext();
    udalost.currentTarget.href = pripravitOtevreniVChromu(aktualniStrankaUrl());
  };

  const hlavniKlavesa = (udalost: KeyboardEvent<HTMLElement>) => {
    if (cesta.typ === "CHROME_INTENT") {
      return;
    }

    if (udalost.key === "Enter" || udalost.key === " ") {
      udalost.preventDefault();
      void hlavniKlik();
    }
  };

  if (!viditelnost.viditelna) {
    return null;
  }

  const podklad = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const stylObalu: CSSProperties | undefined =
    topPx !== null ? { top: `${topPx}px` } : undefined;

  const viceRadku = cesta.typ === "CHROME_INTENT";
  const tridaPlochy = [
    "brana-vyzva-plocha",
    pripravena ? "brana-vyzva-plocha--viditelna" : "",
    viceRadku ? "brana-vyzva-plocha--vice-radku" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={stylObalu}
      role="region"
      aria-label={
        cesta.typ === "CHROME_INTENT"
          ? BRANA_TEKST_OTEVRIT_V_CHROMU
          : "Přidat BRÁNU na plochu"
      }
    >
      <div className={tridaPlochy} style={{ backgroundColor: podklad }}>
        <button
          type="button"
          className="brana-vyzva-plocha-zavrit"
          aria-label="Zavřít"
          onClick={zavrit}
        >
          <span aria-hidden>×</span>
        </button>

        {cesta.typ === "CHROME_INTENT" ? (
          <a
            href={cesta.url}
            onClick={otevritVChromu}
            className="brana-vyzva-plocha-hlavni brana-vyzva-plocha-hlavni--odkaz"
            aria-label={BRANA_TEKST_OTEVRIT_V_CHROMU}
          >
            <span className="brana-vyzva-plocha-text brana-vyzva-plocha-text--vice-radku">
              {BRANA_TEKST_OTEVRIT_V_CHROMU}
            </span>
            <span className="brana-vyzva-plocha-sipka" aria-hidden>
              →
            </span>
          </a>
        ) : (
          <div
            className="brana-vyzva-plocha-hlavni"
            role="button"
            tabIndex={0}
            aria-label="Přidat BRÁNU na plochu"
            onClick={() => void hlavniKlik()}
            onKeyDown={hlavniKlavesa}
          >
            <span className="brana-vyzva-plocha-text">
              Přidat{" "}
              <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na plochu
            </span>
            <span className="brana-vyzva-plocha-sipka" aria-hidden>
              →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
