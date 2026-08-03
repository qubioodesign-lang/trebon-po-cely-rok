"use client";

import { useEffect, useState } from "react";
import {
  priZmeneTrebonIosInstalacniVrstvy,
  ziskatTrebonIosInstalacniVrstvu,
  zavritTrebonIosInstalacniVrstvu,
  type TrebonIosInstalacniVarianta,
} from "@/lib/trebon-ios-instalace";

function textKroku(varianta: TrebonIosInstalacniVarianta): {
  radek1: string;
  radek2: string;
} {
  if (varianta === "SAFARI") {
    return {
      radek1: "Klepněte na Sdílet",
      radek2: "Pak Přidat na plochu",
    };
  }

  return {
    radek1: "Otevřete Třeboň v Safari",
    radek2: "Pak Sdílet → Přidat na plochu",
  };
}

export function TrebonIosInstalacniVrstva() {
  const [stav, setStav] = useState(ziskatTrebonIosInstalacniVrstvu);

  useEffect(() => {
    return priZmeneTrebonIosInstalacniVrstvy(() => {
      setStav(ziskatTrebonIosInstalacniVrstvu());
    });
  }, []);

  if (!stav.otevreno || !stav.varianta) {
    return null;
  }

  const { radek1, radek2 } = textKroku(stav.varianta);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-krem/90 px-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trebon-ios-instalace-nadpis"
    >
      <button
        type="button"
        className="absolute right-6 border-0 bg-transparent p-0 text-text-jemny transition-colors duration-300 hover:text-text focus-visible:text-text focus-visible:outline-none"
        style={{ top: "calc(2rem + env(safe-area-inset-top, 0px))" }}
        aria-label="Zavřít"
        onClick={zavritTrebonIosInstalacniVrstvu}
      >
        <span aria-hidden className="text-xl leading-none">
          ×
        </span>
      </button>

      <div className="flex max-w-sm flex-col items-center text-center">
        <h2
          id="trebon-ios-instalace-nadpis"
          className="mb-8 text-sm font-light tracking-wide text-text-jemny"
        >
          Na plochu
        </h2>
        <p className="text-[1.0625rem] font-light leading-snug tracking-wide text-text">
          {radek1}
        </p>
        <p className="mt-3 text-[1.0625rem] font-light leading-snug tracking-wide text-text">
          {radek2}
        </p>
      </div>
    </div>
  );
}
