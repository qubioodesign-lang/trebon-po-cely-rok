import type { Metadata } from "next";
import { headers } from "next/headers";
import { GalerieHlavni } from "@/components/GalerieHlavni";
import { ziskatMetadataGalerie } from "@/lib/og-metadata";
import { ziskatAktivniPolozky } from "@/lib/polozky";

/** Galerie načítá data za běhu z Blob – ne při buildu */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ polozka?: string }>;
}): Promise<Metadata> {
  const { polozka } = await searchParams;
  const hlavicky = await headers();
  return ziskatMetadataGalerie(
    polozka,
    hlavicky.get("x-vercel-oidc-token"),
    hlavicky
  );
}

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
