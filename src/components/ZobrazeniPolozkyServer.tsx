import type { PolozkaVerejna } from "@/types";
import { ProlnutiCasOtevreniScript } from "./ProlnutiCasOtevreniScript";

const TRIDA_FOTO =
  "absolute inset-0 h-full w-full object-cover object-center";

const STYL_FOTO = { objectFit: "cover" as const, objectPosition: "center" as const };

/**
 * Serverové vykreslení první fotografie – v HTML okamžitě, bez hydratace.
 * Stejné object-fit jako klientská galerie + inline fallback před načtením CSS.
 */
export function ZobrazeniPolozkyServer({
  polozka,
}: {
  polozka: PolozkaVerejna;
}) {
  if (polozka.typ === "prolnuti") {
    const urls = polozka.urls ?? [];
    const urlA = urls[0];
    if (!urlA) return null;

    return (
      <div className="absolute inset-0">
        <ProlnutiCasOtevreniScript />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urlA}
          alt={polozka.popis || "Třeboň"}
          className={TRIDA_FOTO}
          style={STYL_FOTO}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </div>
    );
  }

  if (polozka.typ === "fotografie" && polozka.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={polozka.url}
        alt={polozka.popis || "Třeboň"}
        className={TRIDA_FOTO}
        style={STYL_FOTO}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    );
  }

  return null;
}
