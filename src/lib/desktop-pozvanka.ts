import { PROLNUTI_LADICI_PAR } from "@/lib/prolnuti-ladici-par";

/** Minimální šířka pro desktop (odpovídá Tailwind `md` a globals.css). */
export const DESKTOP_MIN_SIRKA_PX = 768;

/** Produkční URL v QR – stabilní, generuje se při každém SSR ze stejné konstanty */
export const DESKTOP_POZVANKA_ZDROJ_QR = "desktop-qr";

export const DESKTOP_POZVANKA_URL_MOBILNIHO_WEBU =
  `https://www.trebonpocelyrok.cz?zdroj=${DESKTOP_POZVANKA_ZDROJ_QR}`;

/** Dočasná výchozí fotografie, dokud admin nenahraje vlastní. */
export const DESKTOP_POZVANKA_VYCHOZI_FOTOGRAFIE = PROLNUTI_LADICI_PAR.souborB;
