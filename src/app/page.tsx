import { headers } from "next/headers";
import { GalerieHlavni } from "@/components/GalerieHlavni";
import { ziskatAktivniPolozky } from "@/lib/polozky";

/** Galerie načítá data za běhu z Blob – ne při buildu */
export const dynamic = "force-dynamic";

/**
 * Úvodní obrazovka – data vždy z Blob (ne ze seed souboru).
 */
export default async function HlavniStranka() {
  const hlavicky = await headers();
  const oidcHeader = hlavicky.get("x-vercel-oidc-token");
  const polozky = await ziskatAktivniPolozky(oidcHeader);

  return <GalerieHlavni polozky={polozky} />;
}
