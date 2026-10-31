import sharp from "sharp";
import {
  FACEBOOK_KARTA_SIRKA,
  FACEBOOK_KARTA_VYSKA,
} from "@/lib/facebook-karta";

const POZADI = { r: 0xfa, g: 0xf8, b: 0xf5 };
const MAX_VSTUP = 8 * 1024 * 1024;
const MAX_PIXELU = 24_000_000;

/**
 * Celá fotografie uprostřed plátna 1200×630, bez ořezu.
 * Po stranách nebo nahoře a dole zůstane #FAF8F5.
 */
export async function slozitFacebookKartu(vstup: Buffer): Promise<Buffer> {
  if (vstup.length < 32 || vstup.length > MAX_VSTUP) {
    throw new Error("Nepovolená velikost fotografie.");
  }

  const { data, info } = await sharp(vstup, {
    failOn: "error",
    limitInputPixels: MAX_PIXELU,
    pages: 1,
  })
    .rotate()
    .resize(FACEBOOK_KARTA_SIRKA, FACEBOOK_KARTA_VYSKA, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .toBuffer({ resolveWithObject: true });

  if (
    info.width < 1 ||
    info.height < 1 ||
    info.width > FACEBOOK_KARTA_SIRKA ||
    info.height > FACEBOOK_KARTA_VYSKA
  ) {
    throw new Error("Fotografii nelze vložit do karty.");
  }

  const left = Math.floor((FACEBOOK_KARTA_SIRKA - info.width) / 2);
  const top = Math.floor((FACEBOOK_KARTA_VYSKA - info.height) / 2);

  return sharp({
    create: {
      width: FACEBOOK_KARTA_SIRKA,
      height: FACEBOOK_KARTA_VYSKA,
      channels: 3,
      background: POZADI,
    },
  })
    .composite([{ input: data, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
