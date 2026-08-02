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
  aktualniStrankaUrl,
  BRANA_TEKST_OTEVRIT_V_CHROMU,
  pripravitOtevreniVChromu,
} from "@/lib/brana/otevrit-v-chromu";
import {
  BRANA_PWA_DEN_BARVA,
  BRANA_PWA_NOC_BARVA,
} from "@/lib/brana/konstanty";
import { zvolitInstalacniNavod } from "@/lib/brana/pwa-instalacni-navod";
import {
  jeBranaSpustenaJakoPwa,
  jeInstalacniPromptKDispozici,
  priAppInstalled,
  priZmeneInstalacnihoPromptu,
  vyvolatInstalacniDialog,
} from "@/lib/brana/pwa-instalace";
import {
  potrebujeOtevritVChromu,
  vymazatEmbeddedAndroidKontext,
  vycistitEmbeddedPoInstalaci,
  zapamatovatEmbeddedAndroidKontext,
  zpracovatOtevreniVChromu,
} from "@/lib/brana/vlozeny-android-prohlizec";
import { jeIOS } from "@/lib/uloziste";
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

type RezimVyzvy = "instalace" | "chrome" | "navod";

function zvolitRezimVyzvy(maPrompt: boolean, maNavod: boolean): RezimVyzvy {
  if (maNavod && !maPrompt) {
    return "navod";
  }

  if (jeIOS()) {
    return "instalace";
  }

  if (maPrompt) {
    return "instalace";
  }

  if (potrebujeOtevritVChromu()) {
    return "chrome";
  }

  return "instalace";
}

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
  const [maPrompt, setMaPrompt] = useState(false);
  const [navod, setNavod] = useState<string | null>(null);
  const [chromeUrl, setChromeUrl] = useState("");

  const skrytVyzvu = useCallback(() => {
    setViditelna(false);
    setPripravena(false);
    setNavod(null);
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
    const praveOtevrenoVChromu = zpracovatOtevreniVChromu();
    if (!praveOtevrenoVChromu) {
      zapamatovatEmbeddedAndroidKontext();
    }

    if (jeBranaSpustenaJakoPwa()) {
      vycistitEmbeddedPoInstalaci();
    }

    setMaPrompt(jeInstalacniPromptKDispozici());
    setChromeUrl(pripravitOtevreniVChromu(aktualniStrankaUrl()));

    return priZmeneInstalacnihoPromptu(() => {
      const dostupny = jeInstalacniPromptKDispozici();
      setMaPrompt(dostupny);
      if (dostupny) {
        setNavod(null);
      }
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
      vycistitEmbeddedPoInstalaci();
      zavritVyzvuPlochy();
      skrytVyzvu();
    });
  }, [beziJakoPwa, skrytVyzvu]);

  const zavrit = (udalost: MouseEvent<HTMLButtonElement>) => {
    udalost.stopPropagation();
    udalost.preventDefault();
    zavritVyzvuPlochy();
    skrytVyzvu();
  };

  const rezim: RezimVyzvy = zvolitRezimVyzvy(maPrompt, navod !== null);
  const maAktivniVyzvu =
    rezim === "chrome" ||
    maPrompt ||
    (rezim === "navod" && navod !== null);

  const hlavniKlik = useCallback(async () => {
    if (rezim === "chrome") {
      return;
    }

    if (jeInstalacniPromptKDispozici()) {
      const vysledek = await vyvolatInstalacniDialog();

      if (vysledek === "accepted") {
        zavritVyzvuPlochy();
        skrytVyzvu();
      }

      return;
    }

    setNavod(zvolitInstalacniNavod());
  }, [rezim, skrytVyzvu]);

  const otevritVChromu = (udalost: MouseEvent<HTMLAnchorElement>) => {
    vymazatEmbeddedAndroidKontext();
    udalost.currentTarget.href = pripravitOtevreniVChromu(aktualniStrankaUrl());
  };

  const hlavniKlavesa = (udalost: KeyboardEvent<HTMLElement>) => {
    if (rezim === "chrome") {
      return;
    }

    if (udalost.key === "Enter" || udalost.key === " ") {
      udalost.preventDefault();
      void hlavniKlik();
    }
  };

  if (beziJakoPwa || !viditelna || jeVyzvaPlochyZavrena() || !maAktivniVyzvu) {
    return null;
  }

  const podklad = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const stylObalu: CSSProperties | undefined =
    topPx !== null ? { top: `${topPx}px` } : undefined;

  const viceRadku = rezim === "chrome" || rezim === "navod";
  const tridaPlochy = [
    "brana-vyzva-plocha",
    pripravena ? "brana-vyzva-plocha--viditelna" : "",
    viceRadku ? "brana-vyzva-plocha--vice-radku" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hlavniText =
    rezim === "chrome"
      ? BRANA_TEKST_OTEVRIT_V_CHROMU
      : rezim === "navod"
        ? navod
        : null;

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={stylObalu}
      role="region"
      aria-label={
        rezim === "chrome"
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

        {rezim === "chrome" ? (
          <a
            href={chromeUrl}
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
            aria-label={
              rezim === "navod" ? navod ?? undefined : "Přidat BRÁNU na plochu"
            }
            onClick={() => void hlavniKlik()}
            onKeyDown={hlavniKlavesa}
          >
            {hlavniText ? (
              <span className="brana-vyzva-plocha-text brana-vyzva-plocha-text--vice-radku">
                {hlavniText}
              </span>
            ) : (
              <span className="brana-vyzva-plocha-text">
                Přidat{" "}
                <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na plochu
              </span>
            )}
            {rezim !== "navod" ? (
              <span className="brana-vyzva-plocha-sipka" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
