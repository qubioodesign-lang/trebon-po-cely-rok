"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, type ReactNode } from "react";
import { sousedniBranaStranka } from "@/lib/brana/navigace-stranky";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { useBranaHost } from "@/lib/brana/use-brana-cesty";
import { useBranaKotvaScroll } from "./BranaKotvaScrollProvider";

const MIN_VZDALENOST_SWIPE = 50;
const PRAH_ROZHODNUTI_SMERU = 10;

type TouchStav = {
  aktivni: boolean;
  vodorovne: boolean;
  rozhodnuto: boolean;
  startX: number;
  startY: number;
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
  aktivniStranka: BranaVerejnaStranka;
  children: ReactNode;
  scrollovat?: boolean;
};

/** Obsahová plocha s vodorovným swipe mezi hlavními pohledy BRÁNY. */
export function BranaSwipeObsah({
  aktivniStranka,
  children,
  scrollovat = false,
}: BranaSwipeObsahProps) {
  const router = useRouter();
  const host = useBranaHost();
  const kontext = useBranaKotvaScroll();
  const stavRef = useRef<TouchStav | null>(null);

  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (scrollovat) {
        kontext?.registerScrollRoot(element);
      }
    },
    [scrollovat, kontext],
  );

  const zrusitSledovani = () => {
    stavRef.current = null;
  };

  const naviguj = (smer: "predchozi" | "nasledujici") => {
    const cil = sousedniBranaStranka(aktivniStranka, smer, host);

    if (cil) {
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

  return (
    <section
      ref={ref}
      className="brana-prostor-obsah"
      aria-label="Akce"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={zrusitSledovani}
    >
      {children}
    </section>
  );
}
