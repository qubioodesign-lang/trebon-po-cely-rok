"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
/** Počáteční odjezd snapshotu (px). */
const NUDGE_PX = 6;
/** Bezpečný strop počátečního odjezdu (px). */
const NUDGE_MAX_PX = 8;
/** Trvání počátečního nudgu (ms). */
const NUDGE_TRVANI_MS = 100;
/** Vizuální přesah snapshotu vlevo/vpravo (px) – kryje nudge. */
const PRESAH_PX = 8;
const NAVIGACE_TIMEOUT_MS = 2_500;

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

type OdezvaStav = {
  html: string;
  smer: 1 | -1;
};

type DokonceniStav = {
  html: string;
  smer: 1 | -1;
  startOdjezdX: number;
};

let listovaniPending: ListovaniPending | null = null;
let listovaniOdjezdPx = 0;
let zachytitZivyObsahHtml: (() => string | null) | null = null;
const odezvaPosluchaci = new Set<() => void>();

function indexStranky(stranka: BranaVerejnaStranka): number {
  return BRANA_NAVIGACE_POLOZKY.findIndex((polozka) => polozka.id === stranka);
}

function preferujeReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ctiTranslateX(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;

  if (!t || t === "none") {
    return 0;
  }

  try {
    return new DOMMatrixReadOnly(t).m41;
  } catch {
    const m = t.match(/matrix\(([^)]+)\)/);

    if (!m) {
      return 0;
    }

    const parts = m[1].split(",").map((v) => Number.parseFloat(v.trim()));
    return parts.length >= 6 ? parts[4] : 0;
  }
}

function zrusAnimaci(anim: Animation | null | undefined) {
  if (!anim) {
    return;
  }

  try {
    anim.cancel();
  } catch {
    /* ignore */
  }
}

function omezNudgePx(px: number, smer: 1 | -1): number {
  const znamenko = smer === 1 ? -1 : 1;
  const abs = Math.min(Math.abs(px), NUDGE_MAX_PX);
  return znamenko * abs;
}

/**
 * Připraví vizuální snapshot a směr před navigací (swipe i klik).
 * Spustí posluchače okamžité odezvy na zdrojové stránce.
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
    listovaniOdjezdPx = 0;
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
  listovaniOdjezdPx = 0;
  odezvaPosluchaci.forEach((fn) => {
    fn();
  });
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

function peekListovaniPending(): ListovaniPending | null {
  return listovaniPending;
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
  const prijezdRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const nudgeAnimRef = useRef<Animation | null>(null);
  const dokoncAnimRef = useRef<Animation[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const sledovaniRafRef = useRef<number | null>(null);

  const [odezva, setOdezva] = useState<OdezvaStav | null>(null);
  const [dokonceni, setDokonceni] = useState<DokonceniStav | null>(() => {
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
      startOdjezdX: omezNudgePx(listovaniOdjezdPx, pending.smer),
    };
  });

  const zrusSledovaniRaf = useCallback(() => {
    if (sledovaniRafRef.current != null) {
      window.cancelAnimationFrame(sledovaniRafRef.current);
      sledovaniRafRef.current = null;
    }
  }, []);

  const zrusVsechnyAnimace = useCallback(() => {
    zrusAnimaci(nudgeAnimRef.current);
    nudgeAnimRef.current = null;
    dokoncAnimRef.current.forEach(zrusAnimaci);
    dokoncAnimRef.current = [];
    zrusSledovaniRaf();

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [zrusSledovaniRaf]);

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

    const naOdezvu = () => {
      const pending = peekListovaniPending();

      if (!pending || pending.na === aktivniStranka) {
        return;
      }

      zrusVsechnyAnimace();
      listovaniOdjezdPx = 0;
      setDokonceni(null);
      setOdezva({ html: pending.html, smer: pending.smer });
    };

    odezvaPosluchaci.add(naOdezvu);

    return () => {
      odezvaPosluchaci.delete(naOdezvu);

      if (odjezdRef.current) {
        listovaniOdjezdPx = omezNudgePx(
          ctiTranslateX(odjezdRef.current),
          peekListovaniPending()?.smer ?? 1,
        );
      }

      zrusVsechnyAnimace();
      zachytitZivyObsahHtml = null;
    };
  }, [aktivniStranka, zrusVsechnyAnimace]);

  /** Fáze 1: jemný nudge na zdrojové stránce. */
  useLayoutEffect(() => {
    if (!odezva) {
      return;
    }

    const el = odjezdRef.current;

    if (!el || typeof el.animate !== "function") {
      return;
    }

    const cilX = omezNudgePx(
      odezva.smer === 1 ? -NUDGE_PX : NUDGE_PX,
      odezva.smer,
    );

    zrusAnimaci(nudgeAnimRef.current);
    zrusSledovaniRaf();
    el.style.transform = "translate3d(0, 0, 0)";

    const anim = el.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${cilX}px, 0, 0)` },
      ],
      {
        duration: NUDGE_TRVANI_MS,
        easing: LISTOVANI_EASING,
        fill: "forwards",
      },
    );

    nudgeAnimRef.current = anim;

    const ulozPozici = () => {
      listovaniOdjezdPx = omezNudgePx(ctiTranslateX(el), odezva.smer);
    };

    const sleduj = () => {
      ulozPozici();

      if (nudgeAnimRef.current === anim && anim.playState === "running") {
        sledovaniRafRef.current = window.requestAnimationFrame(sleduj);
      } else {
        sledovaniRafRef.current = null;
        ulozPozici();
        el.style.transform = `translate3d(${listovaniOdjezdPx}px, 0, 0)`;
      }
    };

    sledovaniRafRef.current = window.requestAnimationFrame(sleduj);

    anim.onfinish = () => {
      ulozPozici();
      el.style.transform = `translate3d(${listovaniOdjezdPx}px, 0, 0)`;
      nudgeAnimRef.current = null;
      zrusSledovaniRaf();
    };

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      const pending = peekListovaniPending();

      // Stále čekáme na cílovou stránku – vrať snapshot.
      if (!pending || pending.na === aktivniStranka) {
        return;
      }

      const aktualni = omezNudgePx(ctiTranslateX(el), odezva.smer);
      zrusAnimaci(nudgeAnimRef.current);
      nudgeAnimRef.current = null;
      zrusSledovaniRaf();

      const reverse = el.animate(
        [
          { transform: `translate3d(${aktualni}px, 0, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 160, easing: LISTOVANI_EASING, fill: "forwards" },
      );
      nudgeAnimRef.current = reverse;
      reverse.onfinish = () => {
        el.style.transform = "translate3d(0, 0, 0)";
        listovaniPending = null;
        listovaniOdjezdPx = 0;
        nudgeAnimRef.current = null;
        setOdezva(null);
      };
    }, NAVIGACE_TIMEOUT_MS);

    return () => {
      ulozPozici();
      zrusSledovaniRaf();
    };
  }, [odezva, aktivniStranka, zrusSledovaniRaf]);

  /** Fáze 2: dokončení na cílové stránce z aktuálního offsetu. */
  useLayoutEffect(() => {
    if (!dokonceni) {
      return;
    }

    setOdezva(null);

    const odjezd = odjezdRef.current;
    const prijezd = prijezdRef.current;
    const viewport = viewportRef.current;

    if (!odjezd || !prijezd || !viewport || typeof odjezd.animate !== "function") {
      setDokonceni(null);
      return;
    }

    const sirka = viewport.clientWidth || odjezd.clientWidth || 1;
    const startX = omezNudgePx(dokonceni.startOdjezdX, dokonceni.smer);
    const endOdjezd = -dokonceni.smer * sirka;
    const startPrijezd = startX + dokonceni.smer * sirka;
    const remaining = Math.abs(endOdjezd - startX);
    const duration = Math.max(
      180,
      Math.round(LISTOVANI_TRVANI_MS * (remaining / Math.max(sirka, 1))),
    );

    zrusVsechnyAnimace();

    odjezd.style.transform = `translate3d(${startX}px, 0, 0)`;
    prijezd.style.transform = `translate3d(${startPrijezd}px, 0, 0)`;

    const animOdjezd = odjezd.animate(
      [
        { transform: `translate3d(${startX}px, 0, 0)` },
        { transform: `translate3d(${endOdjezd}px, 0, 0)` },
      ],
      { duration, easing: LISTOVANI_EASING, fill: "forwards" },
    );
    const animPrijezd = prijezd.animate(
      [
        { transform: `translate3d(${startPrijezd}px, 0, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      { duration, easing: LISTOVANI_EASING, fill: "forwards" },
    );

    dokoncAnimRef.current = [animOdjezd, animPrijezd];

    const hotovo = () => {
      listovaniOdjezdPx = 0;
      setDokonceni(null);
    };

    animPrijezd.onfinish = hotovo;

    timeoutRef.current = window.setTimeout(hotovo, duration + 80);

    return () => {
      zrusVsechnyAnimace();
    };
  }, [dokonceni, zrusVsechnyAnimace]);

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

  const prechodAktivni = !!odezva || !!dokonceni;
  const snapshotHtml = odezva?.html ?? dokonceni?.html ?? "";
  const smer = odezva?.smer ?? dokonceni?.smer ?? 1;
  const odjezdClass = dokonceni
    ? "brana-listovani-panel brana-listovani-panel--odjezd brana-listovani-panel--odjezd-absolutni"
    : "brana-listovani-panel brana-listovani-panel--odjezd";

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
      {prechodAktivni ? (
        <div ref={viewportRef} className="brana-listovani-viewport">
          <div
            ref={odjezdRef}
            className={odjezdClass}
            style={{
              // PRESAH_PX je v CSS (left/margin −8px, width +16px)
              ["--brana-listovani-presah" as string]: `${PRESAH_PX}px`,
              transform: dokonceni
                ? `translate3d(${dokonceni.startOdjezdX}px, 0, 0)`
                : "translate3d(0, 0, 0)",
            }}
            aria-hidden="true"
            inert
            dangerouslySetInnerHTML={{ __html: snapshotHtml }}
            data-smer={smer}
          />
          {dokonceni ? (
            <div
              ref={(el) => {
                prijezdRef.current = el;
                zivyObsahRef.current = el;
              }}
              className="brana-listovani-panel brana-listovani-panel--prijezd"
              style={{
                transform: `translate3d(${dokonceni.smer * 100}%, 0, 0)`,
              }}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={prechodAktivni && dokonceni ? undefined : zivyObsahRef}
        className={
          prechodAktivni
            ? "brana-prostor-obsah-vnitr brana-prostor-obsah-vnitr--skryty"
            : "brana-prostor-obsah-vnitr"
        }
        aria-hidden={prechodAktivni && !dokonceni ? true : undefined}
      >
        {dokonceni ? null : children}
      </div>
      {pata}
    </section>
  );
}
