import { ziskatAktivniPolozky } from "@/lib/polozky";
import { GalerieHlavni } from "@/components/GalerieHlavni";

/**
 * Úvodní obrazovka – uživatel ihned vidí fotografii.
 * Žádná viditelná navigace, pouze název přes fotografií.
 */
export default function HlavniStranka() {
  const polozky = ziskatAktivniPolozky();

  return <GalerieHlavni polozky={polozky} />;
}
