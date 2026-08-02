"use client";

import { useCallback, useEffect, useState } from "react";
import {
  popisBranaInstalacniStav,
  urcitBranaInstalacniStav,
} from "@/lib/brana/pwa-instalacni-stav";
import {
  BRANA_OTEVRENO_V_CHROMU_PARAM,
  BRANA_PLNY_CHROME_KLIC,
  jeVlozenyAndroidProhlizec,
  potrebujeOtevritVChromu,
} from "@/lib/brana/vlozeny-android-prohlizec";
import { aktualniStrankaUrl } from "@/lib/brana/otevrit-v-chromu";
import { jeInstalacniPromptKDispozici, jeBranaSpustenaJakoPwa } from "@/lib/brana/pwa-instalace";
import {
  bylaVyzvaPlochyZobrazena,
  jeVyzvaPlochyZavrena,
  zbyvajiciProdlevaVyzvyPlochy,
} from "@/lib/brana/vyzva-plocha";

const SESSION_KLIC_EMBEDDED = "brana_embedded_android";
const DIAG_PARAM = "pwaDiag";

type Diagnostika = Record<string, string>;

function maDiagParam(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return new URL(window.location.href).searchParams.get(DIAG_PARAM) === "1";
}

function formatUserAgentData(): string {
  const uad = (
    navigator as Navigator & {
      userAgentData?: {
        brands?: { brand: string; version: string }[];
        mobile?: boolean;
        platform?: string;
      };
    }
  ).userAgentData;

  if (!uad) {
    return "(nedostupné)";
  }

  return JSON.stringify(
    {
      brands: uad.brands,
      mobile: uad.mobile,
      platform: uad.platform,
    },
    null,
    2,
  );
}

function formatNavigatorStandalone(): string {
  if (!("standalone" in navigator)) {
    return "(nedostupné)";
  }

  const hodnota = (navigator as Navigator & { standalone?: boolean }).standalone;
  return hodnota === true ? "true" : hodnota === false ? "false" : String(hodnota);
}

function sesbiratDiagnostiku(): Diagnostika {
  const maPrompt = jeInstalacniPromptKDispozici();
  const url = new URL(window.location.href);
  const instalacniStav = urcitBranaInstalacniStav({
    vyzvaZavrena: jeVyzvaPlochyZavrena(),
    nainstalovano: jeBranaSpustenaJakoPwa(),
    prodlevaUplynula:
      bylaVyzvaPlochyZobrazena() || zbyvajiciProdlevaVyzvyPlochy() === 0,
    aktualniUrl: aktualniStrankaUrl(),
  });

  return {
    "location.href": window.location.href,
    "document.referrer": document.referrer || "(prázdný)",
    "navigator.userAgent": navigator.userAgent,
    "navigator.userAgentData": formatUserAgentData(),
    "display-mode: standalone":
      window.matchMedia("(display-mode: standalone)").matches ? "ano" : "ne",
    "navigator.standalone": formatNavigatorStandalone(),
    beforeinstallprompt: maPrompt ? "ano (zachycen)" : "ne",
    brana_embedded_android:
      sessionStorage.getItem(SESSION_KLIC_EMBEDDED) ?? "(null)",
    brana_plny_chrome:
      sessionStorage.getItem(BRANA_PLNY_CHROME_KLIC) ?? "(null)",
    [BRANA_OTEVRENO_V_CHROMU_PARAM]:
      url.searchParams.get(BRANA_OTEVRENO_V_CHROMU_PARAM) ?? "(null)",
    "jeVlozenyAndroidProhlizec()": String(jeVlozenyAndroidProhlizec()),
    "potrebujeOtevritVChromu()": String(potrebujeOtevritVChromu()),
    "urcitBranaInstalacniStav()": popisBranaInstalacniStav(instalacniStav),
    cas_mereni: new Date().toISOString(),
  };
}

function diagnostikaDoTextu(data: Diagnostika): string {
  return Object.entries(data)
    .map(([klic, hodnota]) => `${klic}: ${hodnota}`)
    .join("\n");
}

export function BranaPwaDiag() {
  const [aktivni, setAktivni] = useState(false);
  const [data, setData] = useState<Diagnostika | null>(null);
  const [kopirovano, setKopirovano] = useState(false);

  const obnovit = useCallback(() => {
    if (!maDiagParam()) {
      setAktivni(false);
      setData(null);
      return;
    }

    setAktivni(true);
    setData(sesbiratDiagnostiku());
  }, []);

  useEffect(() => {
    obnovit();
    const interval = window.setInterval(obnovit, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [obnovit]);

  const kopirovat = async () => {
    if (!data) {
      return;
    }

    const text = diagnostikaDoTextu(data);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setKopirovano(true);
    window.setTimeout(() => {
      setKopirovano(false);
    }, 2000);
  };

  if (!aktivni || !data) {
    return null;
  }

  return (
    <div
      className="brana-pwa-diag"
      role="region"
      aria-label="Dočasná PWA diagnostika"
    >
      <div className="brana-pwa-diag-hlavicka">
        <strong>BRÁNA PWA diag (?{DIAG_PARAM}=1)</strong>
        <button type="button" className="brana-pwa-diag-kopie" onClick={() => void kopirovat()}>
          {kopirovano ? "Zkopírováno" : "Kopírovat diagnostiku"}
        </button>
      </div>
      <dl className="brana-pwa-diag-seznam">
        {Object.entries(data).map(([klic, hodnota]) => (
          <div key={klic} className="brana-pwa-diag-radek">
            <dt>{klic}</dt>
            <dd>{hodnota}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
