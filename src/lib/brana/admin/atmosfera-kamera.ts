import "server-only";

import { okamzikZPrahy } from "@/lib/brana/cas/cas";
import { BRANA_ATMOSFERA_MAX_STARI_SNIMKU_MS } from "./atmosfera";

export const BRANA_ATMOSFERA_KAMERA_URL =
  "https://www.webcamlive.cz/camera_image.php?idCamera=1016";

export type BranaAtmosferaSnimek = {
  bajty: Buffer;
  finalUrl: string;
  /** ISO UTC odvozené z timestampu ve final URL (lokální čas kamery = Europe/Prague). */
  snimekAtIso: string;
};

export class BranaAtmosferaKameraChyba extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = "BranaAtmosferaKameraChyba";
  }
}

/** YYYYMMDDHHmmss z final URL → ISO UTC (Prague wall clock). */
export function parsovatSnimekAtZUrl(url: string): string | null {
  const m = url.match(/(\d{14})_\d+/);
  if (!m?.[1]) return null;
  const t = m[1];
  const rok = Number(t.slice(0, 4));
  const mesic = Number(t.slice(4, 6));
  const den = Number(t.slice(6, 8));
  const hodina = Number(t.slice(8, 10));
  const minuta = Number(t.slice(10, 12));
  const sekunda = Number(t.slice(12, 14));
  if (
    ![rok, mesic, den, hodina, minuta, sekunda].every((n) =>
      Number.isFinite(n),
    )
  ) {
    return null;
  }
  try {
    const bezSekund = okamzikZPrahy(rok, mesic, den, hodina, minuta);
    const sSekundami = new Date(bezSekund.getTime() + sekunda * 1000);
    return sSekundami.toISOString();
  } catch {
    return null;
  }
}

export function jeSnimekCerstry(
  snimekAtIso: string,
  ted: Date = new Date(),
  maxStariMs: number = BRANA_ATMOSFERA_MAX_STARI_SNIMKU_MS,
): boolean {
  const t = Date.parse(snimekAtIso);
  if (!Number.isFinite(t)) return false;
  const stari = ted.getTime() - t;
  return stari >= 0 && stari <= maxStariMs;
}

export async function nacistAktualniSnimekKamery(): Promise<BranaAtmosferaSnimek> {
  const odpoved = await fetch(BRANA_ATMOSFERA_KAMERA_URL, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      "User-Agent": "BranaAtmosfera/1.0",
      Accept: "image/jpeg,image/*;q=0.9,*/*;q=0.1",
    },
  });

  if (!odpoved.ok) {
    throw new BranaAtmosferaKameraChyba(`Kamera HTTP ${odpoved.status}`);
  }

  const bajty = Buffer.from(await odpoved.arrayBuffer());
  if (bajty.length < 100 || bajty[0] !== 0xff || bajty[1] !== 0xd8) {
    throw new BranaAtmosferaKameraChyba("Kamera nevrátila platný JPEG");
  }

  const finalUrl = odpoved.url || BRANA_ATMOSFERA_KAMERA_URL;
  const snimekAtIso = parsovatSnimekAtZUrl(finalUrl);
  if (!snimekAtIso) {
    throw new BranaAtmosferaKameraChyba(
      "Nelze bezpečně zjistit timestamp snímku",
    );
  }

  if (!jeSnimekCerstry(snimekAtIso)) {
    throw new BranaAtmosferaKameraChyba(
      "Snímek je starší než 30 minut (stale)",
    );
  }

  return { bajty, finalUrl, snimekAtIso };
}
