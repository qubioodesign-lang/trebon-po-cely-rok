"use client";

import {
  BRANA_POZADI_DEN_MASTER,
  BRANA_POZADI_NOC_MASTER,
} from "@/lib/brana/konstanty";

type BranaDesktopPozadiProps = {
  nocRezim: boolean;
};

/**
 * Full-bleed desktopové pozadí BRÁNY – stejný princip jako DesktopPozvanka u Třeboně.
 */
export function BranaDesktopPozadi({ nocRezim }: BranaDesktopPozadiProps) {
  return (
    <div className="brana-desktop-pozadi" aria-hidden>
      <img
        src={nocRezim ? BRANA_POZADI_NOC_MASTER : BRANA_POZADI_DEN_MASTER}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}
