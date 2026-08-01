"use client";

import { sdiletBrana } from "@/lib/brana/sdileni";
import { BranaIkonaSdileni } from "./BranaIkony";

/** Tlačítko sdílení v hlavičce BRÁNY – nativní Web Share API */
export function BranaTlacitkoSdileni() {
  const handleSdilet = async () => {
    try {
      await sdiletBrana();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleSdilet()}
      className="flex h-full w-full items-center justify-center text-white"
      aria-label="Sdílet"
    >
      <BranaIkonaSdileni />
    </button>
  );
}
