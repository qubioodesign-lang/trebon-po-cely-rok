import { headers } from "next/headers";
import { GalerieHlavni } from "@/components/GalerieHlavni";
import { ziskatAktivniPolozky } from "@/lib/polozky";

/** Galerie načítá data za běhu z Blob – ne při buildu */
export const dynamic = "force-dynamic";

/**
 * Úvodní obrazovka – data vždy z Blob (ne ze seed souboru).
 * Volitelný parametr ?polozka=<id> otevře konkrétní sdílenou položku.
 */
export default async function HlavniStranka({
  searchParams,
}: {
  searchParams: Promise<{ polozka?: string }>;
}) {
  const { polozka: pocatecniPolozkaId } = await searchParams;
  const hlavicky = await headers();
  const oidcHeader = hlavicky.get("x-vercel-oidc-token");
  const polozky = await ziskatAktivniPolozky(oidcHeader);

  return (
    <GalerieHlavni
      polozky={polozky}
      pocatecniPolozkaId={pocatecniPolozkaId}
    />
  );
}
