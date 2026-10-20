"use client";

import { useEffect, useRef } from "react";
import { useBranaKotvaScroll } from "./BranaKotvaScrollProvider";

/**
 * Předěl mezi dny nebo roky.
 * Sledovaný bod je spodní okraj textu, ne horní okraj rámečku.
 * `vyhodnotLabel` dál porovnává horní okraj registrovaného prvku.
 */
export function BranaDenniPredel({ label }: { label: string }) {
  const bodRef = useRef<HTMLSpanElement>(null);
  const kontext = useBranaKotvaScroll();

  useEffect(() => {
    if (!kontext || !bodRef.current) {
      return;
    }

    return kontext.registerPredel(bodRef.current);
  }, [kontext]);

  return (
    <div className="brana-denni-predel" aria-hidden>
      <div className="brana-denni-predel-znacka">
        <p className="brana-denni-predel-popis">{label}</p>
        <span ref={bodRef} className="brana-denni-predel-bod" />
      </div>
    </div>
  );
}
