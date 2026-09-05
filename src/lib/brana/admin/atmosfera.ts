import "server-only";

import { createHash } from "node:crypto";

export {
  BRANA_ATMOSFERA_BLOB_CESTA,
  BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA,
  BRANA_ATMOSFERA_STAVY,
  BRANA_ATMOSFERA_STATICKE_STAVY,
  BRANA_ATMOSFERA_DYNAMICKE_STAVY,
  BRANA_ATMOSFERA_VERZE,
  BRANA_ATMOSFERA_MAX_STARI_SNIMKU_MS,
  BRANA_ATMOSFERA_MAX_STARI_PREDCHOZIHO_MS,
  BRANA_ATMOSFERA_RUCNI_TEXT_MAX,
  verejnaVetaAtmosfery,
  verejnaVetaZDokumentuAtmosfery,
  normalizovatRucniTextAtmosfery,
  jeAtmosferaStav,
  jeAtmosferaStatickyStav,
  jeAtmosferaDynamickyStav,
  vychoziAtmosferaDokument,
  parsovatAtmosferaDokument,
  type BranaAtmosferaStav,
  type BranaAtmosferaStatickyStav,
  type BranaAtmosferaDynamickyStav,
  type BranaAtmosferaDuvodStavu,
  type BranaAtmosferaDokument,
} from "../atmosfera";

export function otiskJpegSha256(bajty: Buffer): string {
  return createHash("sha256").update(bajty).digest("hex");
}
