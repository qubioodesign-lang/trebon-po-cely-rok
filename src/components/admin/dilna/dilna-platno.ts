import {
  DILNA_BARVA_TEXTU,
  DILNA_FONT_PX,
  DILNA_GRADIENT_PX,
  DILNA_MAX_STRANA,
  DILNA_OKRAJ_PX,
  DILNA_RADKOVANI_JEDEN,
  DILNA_RADKOVANI_VICE,
  DILNA_RAM_SIRKA,
  DILNA_RAM_VYSKA,
  DILNA_SLOUPEC_PX,
  DILNA_TRACKING_EM,
  DILNA_VAHA,
} from "./dilna-konstanty";

export interface RozmerDilny {
  sirka: number;
  vyska: number;
  naCss: number;
}

/**
 * Výřez 390:844 v pixelech zdroje.
 * Větší fotografie se nezvětšuje. Menší se doplní jen na velikost rámu.
 */
export function rozmerVystupu(
  sirkaZdroje: number,
  vyskaZdroje: number,
): RozmerDilny {
  const pokryti = Math.max(
    DILNA_RAM_SIRKA / sirkaZdroje,
    DILNA_RAM_VYSKA / vyskaZdroje,
  );
  let naCss = pokryti < 1 ? 1 / pokryti : 1;
  let sirka = Math.round(DILNA_RAM_SIRKA * naCss);
  let vyska = Math.round(DILNA_RAM_VYSKA * naCss);
  const nejvetsi = Math.max(sirka, vyska);
  if (nejvetsi > DILNA_MAX_STRANA) {
    naCss *= DILNA_MAX_STRANA / nejvetsi;
    sirka = Math.round(DILNA_RAM_SIRKA * naCss);
    vyska = Math.round(DILNA_RAM_VYSKA * naCss);
  }
  return { sirka, vyska, naCss };
}

/** Enter zůstává. Dlouhý řádek se zalomí do sloupce, dlouhé slovo po znacích. */
export function zalomitText(
  text: string,
  maxSirka: number,
  zmerit: (radek: string) => number,
): string[] {
  const pripraveny = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const vystup: string[] = [];
  for (const odstavec of pripraveny.split("\n")) {
    if (odstavec === "") {
      vystup.push("");
      continue;
    }
    vystup.push(...zalomitOdstavec(odstavec, maxSirka, zmerit));
  }
  return vystup;
}

function zalomitOdstavec(
  odstavec: string,
  maxSirka: number,
  zmerit: (radek: string) => number,
): string[] {
  const radky: string[] = [];
  let radek = "";

  const ulozit = () => {
    radky.push(radek.replace(/\s+$/g, ""));
    radek = "";
  };

  const casti = odstavec.split(/(\s+)/).filter((cast) => cast.length > 0);
  for (const cast of casti) {
    const jeMezera = /^\s+$/.test(cast);
    if (jeMezera) {
      if (radek === "") {
        radek = vejdeSe(cast, maxSirka, zmerit) ? cast : zlomitZnaky(cast, maxSirka, zmerit, radky);
      } else if (vejdeSe(radek + cast, maxSirka, zmerit)) {
        radek += cast;
      } else {
        ulozit();
      }
      continue;
    }

    if (vejdeSe(radek + cast, maxSirka, zmerit)) {
      radek += cast;
      continue;
    }

    if (radek.trim().length > 0) {
      ulozit();
    }

    if (vejdeSe(cast, maxSirka, zmerit)) {
      radek = cast;
      continue;
    }

    radek = zlomitZnaky(cast, maxSirka, zmerit, radky);
  }

  if (radek.length > 0 || radky.length === 0) {
    radky.push(radek.replace(/\s+$/g, ""));
  }
  return radky;
}

function vejdeSe(
  text: string,
  maxSirka: number,
  zmerit: (radek: string) => number,
): boolean {
  return zmerit(text) <= maxSirka;
}

function zlomitZnaky(
  text: string,
  maxSirka: number,
  zmerit: (radek: string) => number,
  radky: string[],
): string {
  let kus = "";
  for (const znak of Array.from(text)) {
    const kandidat = kus + znak;
    if (kus.length > 0 && !vejdeSe(kandidat, maxSirka, zmerit)) {
      radky.push(kus);
      kus = znak;
      continue;
    }
    kus = kandidat;
  }
  return kus;
}

export interface VysledekDilny {
  blob: Blob;
  nevejdeSe: boolean;
}

/**
 * Ořez object-cover, gradient jedoucí s textem, text uprostřed.
 * Vrací PNG. Písmo nezmenšuje.
 */
export async function vykreslitDilnu(
  obrazek: CanvasImageSource & { width: number; height: number },
  text: string,
  posunProcent: number,
  fontFamily: string,
): Promise<VysledekDilny> {
  const rozmer = rozmerVystupu(obrazek.width, obrazek.height);
  const platno = document.createElement("canvas");
  platno.width = rozmer.sirka;
  platno.height = rozmer.vyska;
  const ctx = platno.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Plátno není dostupné.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  vykreslitObal(ctx, obrazek, rozmer.sirka, rozmer.vyska);

  const pripraveny = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (pripraveny.length === 0) {
    return { blob: await pngBlob(platno), nevejdeSe: false };
  }

  const fontPx = DILNA_FONT_PX * rozmer.naCss;
  const sloupec = DILNA_SLOUPEC_PX * rozmer.naCss;
  ctx.font = `${DILNA_VAHA} ${fontPx}px ${fontFamily}`;
  const mezery = nastavitMezery(ctx);

  const zmerit = (radek: string) => sirkaRadku(ctx, radek, fontPx, mezery);
  const radky = zalomitText(pripraveny, sloupec, zmerit);
  const vice = pripraveny.includes("\n") || radky.length > 1;
  const vyskaRadku =
    (vice ? DILNA_RADKOVANI_VICE : DILNA_RADKOVANI_JEDEN) * rozmer.naCss;
  const vyskaBloku = radky.length * vyskaRadku;
  const okraj = DILNA_OKRAJ_PX * rozmer.naCss;
  const nevejdeSe =
    vyskaBloku > rozmer.vyska - okraj * 2 ||
    radky.some((radek) => zmerit(radek) > sloupec + 0.5);

  let horni = rozmer.vyska / 2 + (posunProcent / 100) * rozmer.vyska - vyskaBloku / 2;
  if (!nevejdeSe) {
    const nejvyse = okraj;
    const nejnize = rozmer.vyska - okraj - vyskaBloku;
    if (horni < nejvyse) horni = nejvyse;
    if (horni > nejnize) horni = nejnize;
  }

  vykreslitGradient(ctx, rozmer.sirka, horni + vyskaBloku / 2, rozmer.naCss);

  ctx.fillStyle = DILNA_BARVA_TEXTU;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const pulVolneho = (vyskaRadku - fontPx) / 2;
  radky.forEach((radek, index) => {
    if (!radek) return;
    const y = horni + index * vyskaRadku + pulVolneho;
    nakreslitRadek(ctx, radek, rozmer.sirka / 2, y, fontPx, mezery);
  });

  return { blob: await pngBlob(platno), nevejdeSe };
}

function vykreslitObal(
  ctx: CanvasRenderingContext2D,
  obrazek: CanvasImageSource & { width: number; height: number },
  sirka: number,
  vyska: number,
) {
  const meritko = Math.max(sirka / obrazek.width, vyska / obrazek.height);
  const dw = obrazek.width * meritko;
  const dh = obrazek.height * meritko;
  ctx.drawImage(obrazek, (sirka - dw) / 2, (vyska - dh) / 2, dw, dh);
}

function nastavitMezery(ctx: CanvasRenderingContext2D): boolean {
  if (!("letterSpacing" in ctx)) return false;
  ctx.letterSpacing = `${DILNA_TRACKING_EM}em`;
  return ctx.letterSpacing !== "0px" && ctx.letterSpacing !== "";
}

function sirkaRadku(
  ctx: CanvasRenderingContext2D,
  radek: string,
  fontPx: number,
  mezeryVProhlizeci: boolean,
): number {
  if (!radek) return 0;
  if (mezeryVProhlizeci) {
    return ctx.measureText(radek).width;
  }
  const znaky = Array.from(radek);
  const zaklad = znaky.reduce((soucet, znak) => soucet + ctx.measureText(znak).width, 0);
  const tracking = znaky.length > 1 ? (znaky.length - 1) * fontPx * DILNA_TRACKING_EM : 0;
  return zaklad + tracking;
}

function nakreslitRadek(
  ctx: CanvasRenderingContext2D,
  radek: string,
  stredX: number,
  y: number,
  fontPx: number,
  mezeryVProhlizeci: boolean,
) {
  if (mezeryVProhlizeci) {
    ctx.textAlign = "center";
    ctx.letterSpacing = `${DILNA_TRACKING_EM}em`;
    ctx.fillText(radek, stredX, y);
    return;
  }

  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
  const znaky = Array.from(radek);
  const tracking = fontPx * DILNA_TRACKING_EM;
  let x = stredX - sirkaRadku(ctx, radek, fontPx, false) / 2;
  znaky.forEach((znak, index) => {
    ctx.fillText(znak, x, y);
    x += ctx.measureText(znak).width;
    if (index < znaky.length - 1) x += tracking;
  });
}

/** Gradient galerie, vystředěný na blok textu. Konce mimo plátno se oříznou. */
function vykreslitGradient(
  ctx: CanvasRenderingContext2D,
  sirka: number,
  stredY: number,
  naCss: number,
) {
  const vyska = DILNA_GRADIENT_PX * naCss;
  const horni = stredY - vyska / 2;
  const gradient = ctx.createLinearGradient(0, horni + vyska, 0, horni);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.65)");
  gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.35)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horni, sirka, vyska);
}

function pngBlob(platno: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    platno.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG se nepodařilo vytvořit."));
    }, "image/png");
  });
}
