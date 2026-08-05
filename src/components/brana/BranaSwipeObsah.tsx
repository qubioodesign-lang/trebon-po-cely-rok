"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BRANA_NAVIGACE_POLOZKY } from "@/lib/brana/cesty";
import { sousedniBranaStranka } from "@/lib/brana/navigace-stranky";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { useBranaHost } from "@/lib/brana/use-brana-cesty";
import { useBranaKotvaScroll } from "./BranaKotvaScrollProvider";

const MIN_VZDALENOST_SWIPE = 50;
const PRAH_ROZHODNUTI_SMERU = 10;
const LISTOVANI_TRVANI_MS = 360;
const LISTOVANI_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type TouchStav = {
  aktivni: boolean;
  vodorovne: boolean;
  rozhodnuto: boolean;
  startX: number;
  startY: number;
};

type ListovaniPending = {
  html: string;
  /** 1 = dopředu (starý doleva, nový zprava), -1 = zpět */
  smer: 1 | -1;
  na: BranaVerejnaStranka;
};

type PrechodStav = {
  html: string;
  smer: 1 | -1;
  bezi: boolean;
};

let listovaniPending: ListovaniPending | null = null;
let zachytitZivyObsahHtml: (() => string | null) | null = null;

function indexStranky(stranka: BranaVerejnaStranka): number {
  return BRANA_NAVIGACE_POLOZKY.findIndex((polozka) => polozka.id === stranka);
}

function preferujeReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Připraví vizuální snapshot a směr před navigací (swipe i klik).
 * Nikdy neblokuje navigaci – při nejistotě pending nenastaví.
 */
export function pripravitBranaListovani(
  z: BranaVerejnaStranka,
  na: BranaVerejnaStranka,
): void {
  if (z === na) {
    return;
  }

  if (preferujeReducedMotion()) {
    listovaniPending = null;
    return;
  }

  const indexZ = indexStranky(z);
  const indexNa = indexStranky(na);

  if (indexZ < 0 || indexNa < 0) {
    listovaniPending = null;
    return;
  }

  const html = zachytitZivyObsahHtml?.();

  if (!html) {
    listovaniPending = null;
    return;
  }

  listovaniPending = {
    html,
    smer: indexNa > indexZ ? 1 : -1,
    na,
  };
}

function vzitListovaniPending(
  ocekavana: BranaVerejnaStranka,
): ListovaniPending | null {
  if (!listovaniPending || listovaniPending.na !== ocekavana) {
    return null;
  }

  const pending = listovaniPending;
  listovaniPending = null;
  return pending;
}

function jeInteraktivniPrvek(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest(
    'a, button, input, textarea, select, label, [role="button"], [contenteditable="true"]',
  );
}

type BranaSwipeObsahProps = {
  aktivniStranka: BranaVerejnaStranka;
  children: ReactNode;
  /** Zápatí mimo listovací panely, stále uvnitř scrollovací plochy. */
  pata: ReactNode;
  scrollovat?: boolean;
};

/** Obsahová plocha s vodorovným swipe mezi hlavními pohledy BRÁNY. */
export function BranaSwipeObsah({
  aktivniStranka,
  children,
  pata,
  scrollovat = false,
}: BranaSwipeObsahProps) {
  const router = useRouter();
  const host = useBranaHost();
  const kontext = useBranaKotvaScroll();
  const stavRef = useRef<TouchStav | null>(null);
  const zivyObsahRef = useRef<HTMLDivElement | null>(null);
  const odjezdRef = useRef<HTMLDivElement | null>(null);
  const prechodCleanupRef = useRef<(() => void) | null>(null);

  const [prechod, setPrechod] = useState<PrechodStav | null>(() => {
    if (typeof window === "undefined" || preferujeReducedMotion()) {
      return null;
    }

    const pending = vzitListovaniPending(aktivniStranka);

    if (!pending) {
      return null;
    }

    return {
      html: pending.html,
      smer: pending.smer,
      bezi: false,
    };
  });

  const spojenyRef = useCallback(
    (element: HTMLElement | null) => {
      if (scrollovat) {
        kontext?.registerScrollRoot(element);
      }
    },
    [scrollovat, kontext],
  );

  useEffect(() => {
    zachytitZivyObsahHtml = () => {
      const el = zivyObsahRef.current;

      if (!el) {
        return null;
      }

      return el.innerHTML;
    };

    return () => {
      zachytitZivyObsahHtml = null;
      prechodCleanupRef.current?.();
      prechodCleanupRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!prechod || prechod.bezi) {
      return;
    }

    let zruseno = false;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (zruseno) {
          return;
        }

        setPrechod((stav) => (stav ? { ...stav, bezi: true } : null));
      });
    });

    prechodCleanupRef.current = () => {
      zruseno = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };

    return () => {
      zruseno = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      prechodCleanupRef.current = null;
    };
  }, [prechod]);

  useEffect(() => {
    if (!prechod?.bezi) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPrechod(null);
    }, LISTOVANI_TRVANI_MS + 80);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [prechod?.bezi]);

  const dokoncPrechod = useCallback(() => {
    setPrechod(null);
  }, []);

  const zrusitSledovani = () => {
    stavRef.current = null;
  };

  const naviguj = (smer: "predchozi" | "nasledujici") => {
    const cil = sousedniBranaStranka(aktivniStranka, smer, host);

    if (cil) {
      pripravitBranaListovani(aktivniStranka, cil.id);
      router.push(cil.href);
    }
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (jeInteraktivniPrvek(event.target)) {
      return;
    }

    const touch = event.changedTouches[0] ?? event.touches[0];

    if (!touch) {
      return;
    }

    stavRef.current = {
      aktivni: true,
      vodorovne: false,
      rozhodnuto: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  };

  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const stav = stavRef.current;

    if (!stav?.aktivni || stav.rozhodnuto) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const dx = Math.abs(touch.clientX - stav.startX);
    const dy = Math.abs(touch.clientY - stav.startY);

    if (dx < PRAH_ROZHODNUTI_SMERU && dy < PRAH_ROZHODNUTI_SMERU) {
      return;
    }

    if (dy > dx) {
      zrusitSledovani();
      return;
    }

    stav.vodorovne = true;
    stav.rozhodnuto = true;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const stav = stavRef.current;
    stavRef.current = null;

    if (!stav?.aktivni || !stav.vodorovne) {
      return;
    }

    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const dx = touch.clientX - stav.startX;

    if (Math.abs(dx) < MIN_VZDALENOST_SWIPE) {
      return;
    }

    if (dx < 0) {
      naviguj("nasledujici");
      return;
    }

    naviguj("predchozi");
  };

  const odjezdTransform = prechod
    ? prechod.bezi
      ? `translate3d(${-prechod.smer * 100}%, 0, 0)`
      : "translate3d(0, 0, 0)"
    : undefined;
  const prijezdTransform = prechod
    ? prechod.bezi
      ? "translate3d(0, 0, 0)"
      : `translate3d(${prechod.smer * 100}%, 0, 0)`
    : undefined;

  const viewportStyle = {
    ["--brana-listovani-trvani" as string]: `${LISTOVANI_TRVANI_MS}ms`,
    ["--brana-listovani-easing" as string]: LISTOVANI_EASING,
  } as CSSProperties;

  return (
    <section
      ref={spojenyRef}
      className="brana-prostor-obsah"
      aria-label="Akce"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={zrusitSledovani}
    >
      {prechod ? (
        <div className="brana-listovani-viewport" style={viewportStyle}>
          <div
            ref={odjezdRef}
            className={
              prechod.bezi
                ? "brana-listovani-panel brana-listovani-panel--odjezd brana-listovani-panel--bezi"
                : "brana-listovani-panel brana-listovani-panel--odjezd"
            }
            style={{ transform: odjezdTransform }}
            aria-hidden="true"
            inert
            dangerouslySetInnerHTML={{ __html: prechod.html }}
          />
          <div
            ref={zivyObsahRef}
            className={
              prechod.bezi
                ? "brana-listovani-panel brana-listovani-panel--prijezd brana-listovani-panel--bezi"
                : "brana-listovani-panel brana-listovani-panel--prijezd"
            }
            style={{ transform: prijezdTransform }}
            onTransitionEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.propertyName === "transform"
              ) {
                dokoncPrechod();
              }
            }}
          >
            {children}
          </div>
        </div>
      ) : (
        <div ref={zivyObsahRef} className="brana-prostor-obsah-vnitr">
          {children}
        </div>
      )}
      {pata}
    </section>
  );
}
