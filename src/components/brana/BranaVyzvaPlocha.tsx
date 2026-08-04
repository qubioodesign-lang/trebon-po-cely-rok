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
import { jeBranaSubdomenaHost } from "@/lib/brana/cesty";
import { aktualniStrankaUrl } from "@/lib/brana/otevrit-v-chromu";
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
  bylaVyzvaPlochyZobrazena,
  jeVyzvaPlochyZavrena,
  oznacVyzvuPlochyZobrazenou,
  pohledVyzvyZPathname,
  sledovatPohledVyzvyPlochy,
  smiSeZobrazitVyzvaPlochy,
  zbyvajiciZdvorilostVyzvyPlochy,
  zavritVyzvuPlochy,
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
  const pathname = usePathname();
  const [politikaSplnena, setPolitikaSplnena] = useState(() =>
    bylaVyzvaPlochyZobrazena() || smiSeZobrazitVyzvaPlochy(),
  );
  const [pripravena, setPripravena] = useState(() =>
    bylaVyzvaPlochyZobrazena(),
  );
  const [topPx, setTopPx] = useState<number | null>(null);
  const [prepoctiVerze, setPrepoctiVerze] = useState(0);
  /** Instalační výzva jen na subdoméně – www /brana není druhá PWA. */
  const [naInstalacnimOriginu, setNaInstalacnimOriginu] = useState(false);
  const klikProbihaRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setNaInstalacnimOriginu(jeBranaSubdomenaHost(window.location.host));
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const obnovitStav = useCallback(() => {
    setPrepoctiVerze((verze) => verze + 1);
  }, []);

  const vstup = useMemo(() => {
    void prepoctiVerze;

    return {
      vyzvaZavrena: jeVyzvaPlochyZavrena(),
      nainstalovano: jeBranaSpustenaJakoPwa(),
      politikaZobrazeniSplnena: politikaSplnena,
      aktualniUrl: aktualniStrankaUrl(),
    };
  }, [prepoctiVerze, politikaSplnena]);

  const viditelnost = useMemo(
    () => urcitBranaVyzvaViditelnost(vstup),
    [vstup],
  );

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

    // Android: bez BIP se výzva nesmí zobrazit (viditelnost gate).
    if (
      !urcitBranaVyzvaViditelnost({
        vyzvaZavrena: false,
        nainstalovano: false,
        politikaZobrazeniSplnena: true,
        aktualniUrl: aktualniStrankaUrl(),
      }).viditelna
    ) {
      setPolitikaSplnena(true);
      obnovitStav();
      return;
    }

    oznacVyzvuPlochyZobrazenou();
    setPolitikaSplnena(true);
    requestAnimationFrame(() => {
      setPripravena(true);
    });
  }, [obnovitStav]);

  const zkusZobrazitPoZajmu = useCallback(() => {
    setPolitikaSplnena(smiSeZobrazitVyzvaPlochy());
    if (smiSeZobrazitVyzvaPlochy()) {
      zobraz();
    }
  }, [zobraz]);

  useEffect(() => {
    obnovitStav();

    return priZmeneInstalacnihoPromptu(() => {
      obnovitStav();
      if (jeInstalacniPromptKDispozici() && smiSeZobrazitVyzvaPlochy()) {
        zobraz();
      }
    });
  }, [obnovitStav, zobraz]);

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

    return () => {
      window.clearTimeout(timeoutZdvorilost);
    };
  }, [zkusZobrazitPoZajmu]);

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
    if (klikProbihaRef.current) {
      return;
    }

    const okamzita = urcitBranaCestuPoKliknuti({
      aktualniUrl: aktualniStrankaUrl(),
    });

    if (okamzita.typ === "IOS_INSTALACE") {
      otevritBranaIosInstalacniObrazovku(okamzita.varianta);
      return;
    }

    if (okamzita.typ !== "PROMPT") {
      return;
    }

    klikProbihaRef.current = true;

    try {
      const vysledek = await vyvolatInstalacniDialog();

      if (mountedRef.current && vysledek === "accepted") {
        zavritVyzvuPlochy();
        skrytVyzvu();
      }
    } finally {
      klikProbihaRef.current = false;

      if (mountedRef.current) {
        obnovitStav();
      }
    }
  }, [obnovitStav, skrytVyzvu]);

  const hlavniKlavesa = (udalost: KeyboardEvent<HTMLElement>) => {
    if (klikProbihaRef.current) {
      return;
    }

    if (udalost.key === "Enter" || udalost.key === " ") {
      udalost.preventDefault();
      void hlavniKlik();
    }
  };

  if (!naInstalacnimOriginu || !viditelnost.viditelna) {
    return null;
  }

  const podklad = nocRezim ? BRANA_PWA_NOC_BARVA : BRANA_PWA_DEN_BARVA;
  const stylObalu: CSSProperties | undefined =
    topPx !== null ? { top: `${topPx}px` } : undefined;

  const tridaPlochy = [
    "brana-vyzva-plocha",
    pripravena ? "brana-vyzva-plocha--viditelna" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="brana-vyzva-plocha-obal"
      style={stylObalu}
      role="region"
      aria-label="Přidat BRÁNU na plochu"
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
      </div>
    </div>
  );
}
