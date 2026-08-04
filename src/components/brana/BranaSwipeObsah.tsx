"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from "react";

const MIN_VZDALENOST_SWIPE = 50;
const PRAH_ROZHODNUTI_SMERU = 10;
export const BRANA_LISTOVANI_TRVANI_MS = 360;
const LISTOVANI_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type TouchStav = {
  aktivni: boolean;
  vodorovne: boolean;
  rozhodnuto: boolean;
  startX: number;
  startY: number;
};

export type BranaListovaniPrechod = {
  /** 1 = dopředu (starý doleva, nový zprava), -1 = zpět */
  smer: 1 | -1;
  bezi: boolean;
  odjezd: ReactNode;
  prijezd: ReactNode;
};

function jeInteraktivniPrvek(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest(
    'a, button, input, textarea, select, label, [role="button"], [contenteditable="true"]',
  );
}

type BranaSwipeObsahProps = {
  children: ReactNode;
  /** Zápatí mimo listovací panely, stále uvnitř scrollovací plochy. */
  pata: ReactNode;
  scrollovat?: boolean;
  prechod: BranaListovaniPrechod | null;
  onPrechodBezi: () => void;
  onPrechodHotovo: () => void;
  onSwipe: (smer: "predchozi" | "nasledujici") => void;
  registerScrollRoot?: (element: HTMLElement | null) => void;
  /** Ref na section.brana-prostor-obsah (scrollovací kořen). */
  scrollRootRef?: MutableRefObject<HTMLElement | null>;
};

/** Obsahová plocha s vodorovným swipe a živým listováním mezi pohledy. */
export function BranaSwipeObsah({
  children,
  pata,
  scrollovat = false,
  prechod,
  onPrechodBezi,
  onPrechodHotovo,
  onSwipe,
  registerScrollRoot,
  scrollRootRef,
}: BranaSwipeObsahProps) {
  const stavRef = useRef<TouchStav | null>(null);
  const prechodCleanupRef = useRef<(() => void) | null>(null);

  const spojenyRef = useCallback(
    (element: HTMLElement | null) => {
      if (scrollRootRef) {
        scrollRootRef.current = element;
      }

      if (scrollovat) {
        registerScrollRoot?.(element);
      }
    },
    [scrollovat, registerScrollRoot, scrollRootRef],
  );

  useLayoutEffect(() => {
    if (!prechod || prechod.bezi) {
      return;
    }

    let zruseno = false;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (!zruseno) {
          onPrechodBezi();
        }
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
  }, [prechod, onPrechodBezi]);

  useEffect(() => {
    if (!prechod?.bezi) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onPrechodHotovo();
    }, BRANA_LISTOVANI_TRVANI_MS + 80);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [prechod?.bezi, onPrechodHotovo]);

  useEffect(() => {
    return () => {
      prechodCleanupRef.current?.();
      prechodCleanupRef.current = null;
    };
  }, []);

  const zrusitSledovani = () => {
    stavRef.current = null;
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
      onSwipe("nasledujici");
      return;
    }

    onSwipe("predchozi");
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
    ["--brana-listovani-trvani" as string]: `${BRANA_LISTOVANI_TRVANI_MS}ms`,
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
            className={
              prechod.bezi
                ? "brana-listovani-panel brana-listovani-panel--odjezd brana-listovani-panel--bezi"
                : "brana-listovani-panel brana-listovani-panel--odjezd"
            }
            style={{ transform: odjezdTransform }}
            aria-hidden="true"
            inert
          >
            {prechod.odjezd}
          </div>
          <div
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
                onPrechodHotovo();
              }
            }}
          >
            {prechod.prijezd}
          </div>
        </div>
      ) : (
        <div className="brana-prostor-obsah-vnitr">{children}</div>
      )}
      {pata}
    </section>
  );
}
