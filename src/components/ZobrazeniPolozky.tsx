"use client";

import { useEffect, useState } from "react";
import type { PolozkaVerejna } from "@/types";

interface PropsZobrazeniPolozky {
  polozka: PolozkaVerejna;
  jeAktivni: boolean;
}

function PlaceholderFotografie({ popis }: { popis: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-krem-tmavsi"
      role="img"
      aria-label={popis || "fotografie není k dispozici"}
    >
      <p className="px-6 text-center text-xs font-light text-text-velmiJemny">
        fotografie není k dispozici
      </p>
    </div>
  );
}

/**
 * Zobrazení jedné položky – fotografie nebo video.
 * Architektura připravena pro budoucí video obsah.
 */
export function ZobrazeniPolozky({ polozka, jeAktivni }: PropsZobrazeniPolozky) {
  const [chybaObrazku, setChybaObrazku] = useState(false);

  useEffect(() => {
    setChybaObrazku(false);
  }, [polozka.id, polozka.url]);

  if (polozka.typ === "video") {
    if (chybaObrazku) {
      return <PlaceholderFotografie popis={polozka.popis} />;
    }

    return (
      <video
        src={polozka.url}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload={jeAktivni ? "auto" : "none"}
        onError={() => setChybaObrazku(true)}
      />
    );
  }

  if (chybaObrazku) {
    return <PlaceholderFotografie popis={polozka.popis} />;
  }

  // Běžný img – bez next/image optimalizace, aby 404 nezpůsobilo pád SSR
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={polozka.url}
      alt={polozka.popis || "Třeboň"}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setChybaObrazku(true)}
    />
  );
}
