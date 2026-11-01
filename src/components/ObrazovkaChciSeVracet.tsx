"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { jeIOS, jePWA } from "@/lib/uloziste";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";
import { useChovaniNavstevnika } from "@/hooks/useChovaniNavstevnika";
import { useMetriky } from "@/hooks/useMetriky";
import { TrebonIosInstalacniVrstva } from "@/components/TrebonIosInstalacniVrstva";
import {
  otevritTrebonIosInstalacniVrstvu,
  urcitTrebonIosInstalacniVariantu,
} from "@/lib/trebon-ios-instalace";
import {
  inicializovatTrebonPwaInstalaci,
  jeTrebonInstalacniPromptKDispozici,
  priTrebonAppInstalled,
  priZmeneTrebonInstalacnihoPromptu,
  vyvolatTrebonInstalacniDialog,
} from "@/lib/trebon-pwa-instalace";

/**
 * Stejný intent:// jako ověřená zkouška na Honor 70.
 * Parametr nese jen cíl v Chromu. Záložní adresa zůstává bez něj.
 */
const ODKAZ_OTEVRIT_V_CHROMU =
  "intent://www.trebonpocelyrok.cz/chci-se-vracet?dokoncit=1#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fwww.trebonpocelyrok.cz%2Fchci-se-vracet;end";

/** Interní prohlížeč Facebooku na Androidu. V běžném Chromu tyto značky nejsou. */
function jeFacebookNaAndroidu(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const prohlizec = navigator.userAgent;
  return /Android/i.test(prohlizec) && /FB_IAB|FBAN|FBAV/.test(prohlizec);
}

/** Zpět jen když předchozí záznam historie je na stejném originu; jinak galerie. */
function muzeBezpecneZpet(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const navigation = (
    window as Window & {
      navigation?: {
        currentEntry?: { index: number };
        entries: () => { url?: string }[];
      };
    }
  ).navigation;

  if (
    navigation?.currentEntry &&
    typeof navigation.currentEntry.index === "number" &&
    typeof navigation.entries === "function"
  ) {
    const index = navigation.currentEntry.index;
    if (index <= 0) {
      return false;
    }
    const predchozi = navigation.entries()[index - 1];
    if (!predchozi?.url) {
      return false;
    }
    try {
      return new URL(predchozi.url).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  if (window.history.length <= 1) {
    return false;
  }

  const referrer = document.referrer;
  if (!referrer) {
    return false;
  }

  try {
    return new URL(referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí.
 * CTA vede k přidání Třeboně na plochu (ne k push upozornění).
 */
export function ObrazovkaChciSeVracet({
  dokoncitInstalaci = false,
}: {
  /** Chrome otevřený z facebookového postupu. Bez příznaku zůstává celá obrazovka. */
  dokoncitInstalaci?: boolean;
}) {
  useChovaniNavstevnika("chci_se_vracet");
  const router = useRouter();
  const { odeslat } = useMetriky();
  const [nacita, setNacita] = useState(false);
  const [nainstalovano, setNainstalovano] = useState(() => jePWA());
  const [hlaska, setHlaska] = useState("");
  const [otevritVChromu, setOtevritVChromu] = useState(false);

  const zavrit = useCallback(() => {
    if (muzeBezpecneZpet()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [router]);

  const obnovitStavInstalace = useCallback(() => {
    if (jePWA()) {
      setNainstalovano(true);
    }
  }, []);

  useEffect(() => {
    inicializovatTrebonPwaInstalaci();
    void ziskatNeboRegistrovatServiceWorker().catch(() => {
      // Stejný /sw.js jako RegistracePWA – potřeba i při přímém vstupu na stránku
    });

    obnovitStavInstalace();

    const zrusInstalaci = priTrebonAppInstalled(() => {
      setNainstalovano(true);
      setHlaska("");
      setOtevritVChromu(false);
    });

    const zrusPrompt = priZmeneTrebonInstalacnihoPromptu(() => {
      // Prompt může dorazit pozdě – UI se obnoví při dalším kliknutí.
    });

    return () => {
      zrusInstalaci();
      zrusPrompt();
    };
  }, [obnovitStavInstalace]);

  const nabidnoutPrechodDoChromu = () => {
    if (!jeFacebookNaAndroidu()) {
      setHlaska(
        "Přidání na plochu teď v tomto prohlížeči není k dispozici.",
      );
      return;
    }

    setOtevritVChromu(true);
  };

  const handlePridatNaPlochu = async () => {
    setHlaska("");
    setOtevritVChromu(false);

    if (jePWA()) {
      setNainstalovano(true);
      return;
    }

    // Fire-and-forget: zájem o CTA, neblokuje instalační cestu
    odeslat("klik_pridat_na_plochu");

    if (jeIOS()) {
      otevritTrebonIosInstalacniVrstvu(urcitTrebonIosInstalacniVariantu());
      return;
    }

    setNacita(true);

    try {
      if (!jeTrebonInstalacniPromptKDispozici()) {
        nabidnoutPrechodDoChromu();
        return;
      }

      const vysledek = await vyvolatTrebonInstalacniDialog();

      if (vysledek === "accepted") {
        setNainstalovano(true);
        setHlaska("");
        return;
      }

      if (vysledek === "nedostupny") {
        nabidnoutPrechodDoChromu();
      }
    } finally {
      setNacita(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-krem px-8 pt-16 pb-6">
      <button
        type="button"
        onClick={zavrit}
        className="odkaz-jemny absolute right-6 top-8"
        aria-label="Zavřít"
      >
        zavřít
      </button>

      <div className="max-w-sm space-y-2 text-center">
        {otevritVChromu ? (
          <div className="space-y-4">
            <p className="text-xs font-light leading-relaxed text-text-jemny">
              Třeboň si na plochu přidáte v prohlížeči Chrome.
            </p>
            <a
              href={ODKAZ_OTEVRIT_V_CHROMU}
              className="tlacitko-klidne !px-6 !py-2.5 !text-xs"
            >
              Otevřít v Chromu
            </a>
            <p className="text-xs font-light leading-relaxed text-text-jemny">
              Facebook se zeptá, zda chcete otevřít externí aplikaci. Potvrďte{" "}
              <strong className="font-bold">Pokračovat</strong>.
            </p>
          </div>
        ) : dokoncitInstalaci ? (
          <div className="space-y-4">
            <p className="text-pretty text-[1.125rem] font-light leading-relaxed tracking-wide text-text/80">
              Teď už si můžete Třeboň přidat na plochu.
            </p>
            {nainstalovano ? (
              <p className="text-xs font-light tracking-wide text-text-velmiJemny">
                Třeboň přidána na plochu
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void handlePridatNaPlochu()}
                disabled={nacita}
                className="tlacitko-klidne !px-6 !py-2.5 !text-xs"
              >
                {nacita ? "…" : "Přidat Třeboň na plochu"}
              </button>
            )}
            {hlaska ? (
              <p className="text-xs font-light leading-relaxed text-text-jemny">
                {hlaska}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm font-light leading-relaxed tracking-wide text-text-jemny">
              <p className="text-pretty">
                Třeboň po celý rok je pro všechny, kterým se po Třeboni občas
                zasteskne.
              </p>
              <p>
                Pro chvíle mezi návštěvami.
                <br />
                Pro návraty ve vzpomínkách.
                <br />
                Pro místa, na která se člověk rád vrací.
              </p>
              <p>
                Jen malé kousky Třeboně
                <br />
                během celého roku.
              </p>
            </div>

            <p className="text-pretty px-2 py-3 text-[1.125rem] font-light leading-relaxed tracking-wide text-text/80">
              Chcete vědět, když přibude další malý kousek Třeboně?
            </p>

            {nainstalovano ? (
              <p className="text-xs font-light tracking-wide text-text-velmiJemny">
                Třeboň přidána na plochu
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void handlePridatNaPlochu()}
                disabled={nacita}
                className="tlacitko-klidne !px-6 !py-2.5 !text-xs"
              >
                {nacita ? "…" : "Přidat Třeboň na plochu"}
              </button>
            )}

            {hlaska ? (
              <p className="text-xs font-light leading-relaxed text-text-jemny">
                {hlaska}
              </p>
            ) : null}
          </>
        )}
      </div>

      <TrebonIosInstalacniVrstva />
    </div>
  );
}
