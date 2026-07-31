"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
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

export function BranaCasovaKotvaScrollovana({
  vychoziLabel,
}: {
  vychoziLabel: string;
}) {
  const kontext = useBranaKotvaScroll();
  const label = kontext?.aktualniLabel ?? vychoziLabel;

  return (
    <p className="brana-casova-kotva" aria-label="Časová kotva">
      {label}
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
