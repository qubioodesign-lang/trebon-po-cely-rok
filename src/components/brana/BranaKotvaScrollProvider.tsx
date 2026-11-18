"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import type { BranaKotvaScrollConfig } from "@/lib/brana/kotva-scrollovani";

type BranaKotvaScrollContextValue = {
  registerScrollRoot: (element: HTMLElement | null) => void;
  registerPredel: (element: HTMLElement) => () => void;
  aktualniLabel: string;
};

const BranaKotvaScrollContext = createContext<BranaKotvaScrollContextValue | null>(
  null,
);

function vyhodnotLabel(
  config: BranaKotvaScrollConfig,
  scrollRoot: HTMLElement,
  predely: HTMLElement[],
): string {
  const hranice = scrollRoot.getBoundingClientRect().top;
  let label = config.vychoziLabel;

  for (let index = 0; index < predely.length; index++) {
    if (predely[index].getBoundingClientRect().top < hranice) {
      label = config.poPredelu[index] ?? label;
    }
  }

  return label;
}

type BranaKotvaScrollProviderProps = {
  config: BranaKotvaScrollConfig | null;
  children: ReactNode;
};

export function BranaKotvaScrollProvider({
  config,
  children,
}: BranaKotvaScrollProviderProps) {
  const predelyRef = useRef<HTMLElement[]>([]);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [aktualniLabel, setAktualniLabel] = useState(
    config?.vychoziLabel ?? "",
  );

  const aktualizujLabel = useCallback(() => {
    if (!config || !scrollRoot) {
      return;
    }

    setAktualniLabel(
      vyhodnotLabel(config, scrollRoot, predelyRef.current),
    );
  }, [config, scrollRoot]);

  const registerScrollRoot = useCallback((element: HTMLElement | null) => {
    setScrollRoot(element);
  }, []);

  const registerPredel = useCallback(
    (element: HTMLElement) => {
      predelyRef.current = [...predelyRef.current, element];
      aktualizujLabel();

      return () => {
        predelyRef.current = predelyRef.current.filter(
          (predel) => predel !== element,
        );
        aktualizujLabel();
      };
    },
    [aktualizujLabel],
  );

  useEffect(() => {
    if (!config) {
      return;
    }

    setAktualniLabel(config.vychoziLabel);
  }, [config]);

  useEffect(() => {
    if (!config || !scrollRoot) {
      return;
    }

    const sledovat = () => aktualizujLabel();

    scrollRoot.addEventListener("scroll", sledovat, { passive: true });
    aktualizujLabel();

    return () => {
      scrollRoot.removeEventListener("scroll", sledovat);
    };
  }, [aktualizujLabel, config, scrollRoot]);

  if (!config) {
    return <>{children}</>;
  }

  return (
    <BranaKotvaScrollContext.Provider
      value={{ registerScrollRoot, registerPredel, aktualniLabel }}
    >
      {children}
    </BranaKotvaScrollContext.Provider>
  );
}

export function useBranaKotvaScroll() {
  return useContext(BranaKotvaScrollContext);
}

/** Počáteční hodnota budoucího počítadla. Oddělovač tisíců, bez pevného stropu. */
const BRANA_VZTAH_POCET = "1\u00a0247";

/** Záloha, kdyby animationend nepřišel. Delší než pulz i jeho kratší barevná verze. */
const BRANA_SRDCE_ZAMEK_MS = 800;

/** Klepnutí vyplní srdce a jednou ho zvětší. Číslo zůstává statické. */
export function BranaVztahKTrebone() {
  const srdceRef = useRef<SVGSVGElement>(null);
  const beziRef = useRef(false);
  const casovacRef = useRef<number | null>(null);

  const uvolnitPulz = useCallback(() => {
    if (casovacRef.current !== null) {
      window.clearTimeout(casovacRef.current);
      casovacRef.current = null;
    }

    srdceRef.current?.classList.remove("brana-srdce-pulz");
    beziRef.current = false;
  }, []);

  useEffect(() => () => uvolnitPulz(), [uvolnitPulz]);

  const spustitPulz = () => {
    const srdce = srdceRef.current;

    if (!srdce || beziRef.current) {
      return;
    }

    beziRef.current = true;
    srdce.classList.add("brana-srdce-pulz");
    casovacRef.current = window.setTimeout(uvolnitPulz, BRANA_SRDCE_ZAMEK_MS);
  };

  const poAnimaci = (event: AnimationEvent<SVGSVGElement>) => {
    if (event.target !== srdceRef.current?.querySelector("path")) {
      return;
    }

    uvolnitPulz();
  };

  return (
    <span className="brana-casova-kotva-vztah">
      <button
        type="button"
        className="brana-casova-kotva-vztah-tlacitko"
        aria-label="Třeboň v srdci"
        onClick={spustitPulz}
      >
        <span className="brana-casova-kotva-vztah-text">Třeboň v</span>
        <svg
          ref={srdceRef}
          className="brana-casova-kotva-srdce"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          onAnimationEnd={poAnimaci}
        >
          <path
            d="M12 19.6s-6.6-4.1-6.6-8.2C5.4 8.6 7.2 7 9.1 7c1.2 0 2.2.6 2.9 1.6.7-1 1.7-1.6 2.9-1.6 1.9 0 3.7 1.6 3.7 4.4 0 4.1-6.6 8.2-6.6 8.2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.253"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="brana-casova-kotva-pocet">{BRANA_VZTAH_POCET}</span>
    </span>
  );
}

export function BranaCasovaKotvaScrollovana({
  vychoziLabel,
}: {
  vychoziLabel: string;
}) {
  const kontext = useBranaKotvaScroll();
  const label = kontext?.aktualniLabel ?? vychoziLabel;

  return (
    <p className="brana-casova-kotva" aria-label="Časová kotva">
      <span className="brana-casova-kotva-den">{label}</span>
      <BranaVztahKTrebone />
    </p>
  );
}

export function BranaProstorObsahScrollovany({
  children,
}: {
  children: ReactNode;
}) {
  const kontext = useBranaKotvaScroll();

  const scrollRef = useCallback(
    (element: HTMLElement | null) => {
      kontext?.registerScrollRoot(element);
    },
    [kontext],
  );

  return (
    <section
      ref={scrollRef}
      className="brana-prostor-obsah"
      aria-label="Akce"
    >
      {children}
    </section>
  );
}
