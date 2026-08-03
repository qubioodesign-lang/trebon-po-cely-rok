"use client";

import { useState, useEffect, useCallback } from "react";
import { jeIOS, jePWA } from "@/lib/uloziste";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";
import { useChovaniNavstevnika } from "@/hooks/useChovaniNavstevnika";
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
 * Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí.
 * CTA vede k přidání Třeboně na plochu (ne k push upozornění).
 */
export function ObrazovkaChciSeVracet() {
  useChovaniNavstevnika("chci_se_vracet");
  const [nacita, setNacita] = useState(false);
  const [nainstalovano, setNainstalovano] = useState(() => jePWA());
  const [hlaska, setHlaska] = useState("");

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
    });

    const zrusPrompt = priZmeneTrebonInstalacnihoPromptu(() => {
      // Prompt může dorazit pozdě – UI se obnoví při dalším kliknutí.
    });

    return () => {
      zrusInstalaci();
      zrusPrompt();
    };
  }, [obnovitStavInstalace]);

  const handlePridatNaPlochu = async () => {
    setHlaska("");

    if (jePWA()) {
      setNainstalovano(true);
      return;
    }

    if (jeIOS()) {
      otevritTrebonIosInstalacniVrstvu(urcitTrebonIosInstalacniVariantu());
      return;
    }

    setNacita(true);

    try {
      if (!jeTrebonInstalacniPromptKDispozici()) {
        setHlaska(
          "Přidání na plochu teď v tomto prohlížeči není k dispozici.",
        );
        return;
      }

      const vysledek = await vyvolatTrebonInstalacniDialog();

      if (vysledek === "accepted") {
        setNainstalovano(true);
        setHlaska("");
        return;
      }

      if (vysledek === "nedostupny") {
        setHlaska(
          "Přidání na plochu teď v tomto prohlížeči není k dispozici.",
        );
      }
    } finally {
      setNacita(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-krem px-8 py-16">
      <div className="max-w-sm space-y-8 text-center">
        <div className="space-y-6 text-sm font-light leading-relaxed tracking-wide text-text-jemny">
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

        <p className="text-pretty px-2 py-8 text-[1.125rem] font-light leading-relaxed tracking-wide text-text/80">
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
      </div>

      <TrebonIosInstalacniVrstva />
    </div>
  );
}
