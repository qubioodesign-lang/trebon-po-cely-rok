"use client";

import { useEffect, useRef } from "react";
import { useBranaKotvaScroll } from "./BranaKotvaScrollProvider";

/** Vizuální předěl mezi dny – sledovaný bod pro scroll časovou kotvu. */
export function BranaDenniPredel() {
  const predelRef = useRef<HTMLDivElement>(null);
  const kontext = useBranaKotvaScroll();

  useEffect(() => {
    if (!kontext || !predelRef.current) {
      return;
    }

    return kontext.registerPredel(predelRef.current);
  }, [kontext]);

  return (
    <div ref={predelRef} className="brana-denni-predel" aria-hidden>
      <hr className="brana-denni-predel-linka" />
    </div>
  );
}
