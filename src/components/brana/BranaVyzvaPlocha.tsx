"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  jeInstalacniPromptKDispozici,
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
  pohledVyzvyZPathname,
  resetVychoziScrollVyzvyPlochy,
  sledovatPohledVyzvyPlochy,
  smiSeZobrazitVyzvaPlochy,
  zbyvajiciStropVyzvyPlochy,
  zbyvajiciZdvorilostVyzvyPlochy,
  zavritVyzvuPlochy,
  zpracovatScrollVyzvyPlochy,
} from "@/lib/brana/vyzva-plocha";

const BRANA_PRIPRAVA_MAX_MS = 2_000;
const TEXT_PRIPRAVA = "Připravuji přidání na plochu…";

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

function najdiScrollKontejnerVyzvy(): HTMLElement | null {
  return document.querySelector(".brana-prostor-obsah");
}

export function BranaVyzvaPlocha({ nocRezim }: BranaVyzvaPlochaProps) {
  const pathname = usePathname();
  const [politikaSplnena, setPolitikaSplnena] = useState(() =>
    bylaVyzvaPlochyZobrazena() || smiSeZobrazitVyzvaPlochy(),
  );
  const [pripravena, setPripravena] = useState(() =>
    bylaVyzvaPlochyZobrazena(),
  );
  const [pripravuji, setPripravuji] = useState(false);
  const [topPx, setTopPx] = useState<number | null>(null);
  const [prepoctiVerze, setPrepoctiVerze] = useState(0);
  const pripravujiRef = useRef(false);

  const obnovitStav = useCallback(() => {
    setPrepoctiVerze((verze) => verze + 1);
  }, []);

  const vstup = useMemo(
    () => ({
      vyzvaZavrena: jeVyzvaPlochyZavrena(),
      nainstalovano: jeBranaSpustenaJakoPwa(),
      politikaZobrazeniSplnena: politikaSplnena,
      aktualniUrl: aktualniStrankaUrl(),
    }),
    [prepoctiVerze, politikaSplnena],
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
    if (jeVyzvaPlochyZavrena() || jeBranaSpustenaJakoPwa()) {
      return;
    }

    if (!smiSeZobrazitVyzvaPlochy()) {
      return;
    }

    oznacVyzvuPlochyZobrazenou();
    setPolitikaSplnena(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, []);

  const zkusZobrazitPoZajmu = useCallback(() => {
    setPolitikaSplnena(smiSeZobrazitVyzvaPlochy());
    if (smiSeZobrazitVyzvaPlochy()) {
      zobraz();
    }
  }, [zobraz]);

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
    sledovatPohledVyzvyPlochy(pohledVyzvyZPathname(pathname));
    zkusZobrazitPoZajmu();
  }, [pathname, zkusZobrazitPoZajmu]);

  useEffect(() => {
    if (jeBranaSpustenaJakoPwa() || jeVyzvaPlochyZavrena()) {
      return;
    }

    if (bylaVyzvaPlochyZobrazena()) {
      setPolitikaSplnena(true);
      setPripravena(true);
      return;
    }

    const timeoutZdvorilost = window.setTimeout(() => {
      zkusZobrazitPoZajmu();
    }, zbyvajiciZdvorilostVyzvyPlochy());

    const timeoutStrop = window.setTimeout(() => {
      zkusZobrazitPoZajmu();
    }, zbyvajiciStropVyzvyPlochy());

    return () => {
      window.clearTimeout(timeoutZdvorilost);
      window.clearTimeout(timeoutStrop);
    };
  }, [zkusZobrazitPoZajmu]);

  useEffect(() => {
    if (jeBranaSpustenaJakoPwa() || jeVyzvaPlochyZavrena()) {
      return;
    }

    if (bylaVyzvaPlochyZobrazena()) {
      return;
    }

    let kontejner: HTMLElement | null = null;
    let zruseno = false;

    const naScroll = () => {
      if (!kontejner || zruseno) {
        return;
      }

      zpracovatScrollVyzvyPlochy(
        kontejner.scrollTop,
        kontejner.clientHeight,
        kontejner.scrollHeight,
      );
      zkusZobrazitPoZajmu();
    };

    const pripoj = () => {
      const nalezeny = najdiScrollKontejnerVyzvy();

      if (!nalezeny || nalezeny === kontejner) {
        return;
      }

      if (kontejner) {
        kontejner.removeEventListener("scroll", naScroll);
      }

      resetVychoziScrollVyzvyPlochy();
      kontejner = nalezeny;
      zpracovatScrollVyzvyPlochy(
        kontejner.scrollTop,
        kontejner.clientHeight,
        kontejner.scrollHeight,
      );
      kontejner.addEventListener("scroll", naScroll, { passive: true });
    };

    pripoj();
    const interval = window.setInterval(pripoj, 500);

    return () => {
      zruseno = true;
      window.clearInterval(interval);
      kontejner?.removeEventListener("scroll", naScroll);
    };
  }, [pathname, zkusZobrazitPoZajmu]);

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
    if (pripravujiRef.current) {
      return;
    }

    const okamzita = urcitBranaCestuPoKliknuti({
      aktualniUrl: aktualniStrankaUrl(),
    });

    if (okamzita.typ === "PROMPT") {
      const vysledek = await vyvolatInstalacniDialog();

      if (vysledek === "accepted") {
        zavritVyzvuPlochy();
        skrytVyzvu();
      }

      obnovitStav();
      return;
    }

    if (okamzita.typ === "IOS_INSTALACE") {
      otevritBranaIosInstalacniObrazovku(okamzita.varianta);
      return;
    }

    if (okamzita.typ === "CHROME_INTENT") {
      window.location.href = okamzita.url;
      return;
    }

    pripravujiRef.current = true;
    setPripravuji(true);
    obnovitStav();

    const deadline = Date.now() + BRANA_PRIPRAVA_MAX_MS;

    await new Promise<void>((resolve) => {
      let hotovo = false;

      const dokonci = () => {
        if (hotovo) {
          return;
        }

        hotovo = true;
        window.clearInterval(interval);
        zrusPrompt();
        resolve();
      };

      const zrusPrompt = priZmeneInstalacnihoPromptu(() => {
        if (jeInstalacniPromptKDispozici()) {
          dokonci();
        }
      });

      const interval = window.setInterval(() => {
        if (jeInstalacniPromptKDispozici() || Date.now() >= deadline) {
          dokonci();
        }
      }, 100);
    });

    if (jeInstalacniPromptKDispozici()) {
      const vysledek = await vyvolatInstalacniDialog();

      if (vysledek === "accepted") {
        zavritVyzvuPlochy();
        skrytVyzvu();
      }
    }

    pripravujiRef.current = false;
    setPripravuji(false);
    obnovitStav();
  }, [obnovitStav, skrytVyzvu]);

  const otevritVChromu = (udalost: MouseEvent<HTMLAnchorElement>) => {
    vymazatEmbeddedAndroidKontext();
    udalost.currentTarget.href = pripravitOtevreniVChromu(aktualniStrankaUrl());
  };

  const hlavniKlavesa = (udalost: KeyboardEvent<HTMLElement>) => {
    if (cesta.typ === "CHROME_INTENT" && !pripravuji) {
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

  const chromeOdkaz = cesta.typ === "CHROME_INTENT" && !pripravuji;
  const tridaPlochy = [
    "brana-vyzva-plocha",
    pripravena ? "brana-vyzva-plocha--viditelna" : "",
    chromeOdkaz ? "brana-vyzva-plocha--vice-radku" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={stylObalu}
      role="region"
      aria-label={
        chromeOdkaz ? BRANA_TEKST_OTEVRIT_V_CHROMU : "Přidat BRÁNU na plochu"
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

        {chromeOdkaz ? (
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
            aria-label={pripravuji ? TEXT_PRIPRAVA : "Přidat BRÁNU na plochu"}
            aria-busy={pripravuji || undefined}
            onClick={() => void hlavniKlik()}
            onKeyDown={hlavniKlavesa}
          >
            <span className="brana-vyzva-plocha-text">
              {pripravuji ? (
                TEXT_PRIPRAVA
              ) : (
                <>
                  Přidat{" "}
                  <span className="brana-vyzva-plocha-znacka">BRÁNU</span> na
                  plochu
                </>
              )}
            </span>
            {!pripravuji ? (
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
