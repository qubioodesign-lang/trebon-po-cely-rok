"use client";

import Image from "next/image";
import type { PolozkaVerejna } from "@/types";

interface PropsZobrazeniPolozky {
  polozka: PolozkaVerejna;
  jeAktivni: boolean;
}

/**
 * Zobrazení jedné položky – fotografie nebo video.
 * Architektura připravena pro budoucí video obsah.
 */
export function ZobrazeniPolozky({ polozka, jeAktivni }: PropsZobrazeniPolozky) {
  if (polozka.typ === "video") {
    return (
      <video
        src={polozka.url}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload={jeAktivni ? "auto" : "none"}
      />
    );
  }

  // SVG soubory – běžný img tag (Next.js Image SVG neoptimalizuje)
  if (polozka.url.endsWith(".svg")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={polozka.url}
        alt={polozka.popis || "Třeboň"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <Image
      src={polozka.url}
      alt={polozka.popis || "Třeboň"}
      fill
      className="object-cover"
      priority={jeAktivni}
      sizes="100vw"
      quality={85}
    />
  );
}
