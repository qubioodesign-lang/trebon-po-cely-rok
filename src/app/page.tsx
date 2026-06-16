import { GalerieHlavni } from "@/components/GalerieHlavni";
import { ziskatAktivniPolozky } from "@/lib/polozky";

/**
 * Úvodní obrazovka – uživatel ihned vidí fotografii.
 * Žádná viditelná navigace, pouze název přes fotografií.
 */
export default async function HlavniStranka() {
  const polozky = await ziskatAktivniPolozky();

  return <GalerieHlavni polozky={polozky} />;
}
