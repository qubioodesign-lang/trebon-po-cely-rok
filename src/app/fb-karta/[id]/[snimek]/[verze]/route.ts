import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  jePovolenaCestaUlozenehoSouboru,
  jeUuid,
  parsovatSnimekFacebookKarty,
  souborOdpovidaVerzi,
  souborSnimkuProlnuti,
} from "@/lib/facebook-karta";
import { slozitFacebookKartu } from "@/lib/facebook-karta-obrazek";
import { ziskatPolozku } from "@/lib/polozky";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOADS = path.join(process.cwd(), "public", "uploads");
const MAX_VSTUP = 8 * 1024 * 1024;
const POVOLENE_TYPY = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Veřejný JPEG karty. Čte jen fotografii uloženou u daného prolnutí,
 * a jen když verze v adrese pořád sedí.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; snimek: string; verze: string }> }
) {
  try {
    const { id, snimek: snimekText, verze } = await context.params;
    const snimek = parsovatSnimekFacebookKarty(snimekText);
    if (!jeUuid(id) || !snimek || !jeUuid(verze)) {
      return nenalezeno();
    }

    const hlavicky = await headers();
    const polozka = await ziskatPolozku(
      id,
      hlavicky.get("x-vercel-oidc-token")
    );
    const soubor = souborSnimkuProlnuti(polozka, snimek);
    if (
      !soubor ||
      !jePovolenaCestaUlozenehoSouboru(soubor) ||
      !souborOdpovidaVerzi(soubor, verze)
    ) {
      return nenalezeno();
    }

    const vstup = await nacistPovolenouFotografii(soubor);
    if (!vstup) return nenalezeno();

    const karta = await slozitFacebookKartu(vstup);
    return new NextResponse(new Uint8Array(karta), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return nenalezeno();
  }
}

function nenalezeno(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

async function nacistPovolenouFotografii(soubor: string): Promise<Buffer | null> {
  if (soubor.startsWith("https://")) {
    const odpoved = await fetch(soubor, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/avif" },
    });
    if (odpoved.status !== 200) return null;
    const typ = odpoved.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!typ || !POVOLENE_TYPY.has(typ)) return null;
    const delka = Number(odpoved.headers.get("content-length") ?? "0");
    if (Number.isFinite(delka) && delka > MAX_VSTUP) return null;
    const telo = Buffer.from(await odpoved.arrayBuffer());
    if (telo.length < 32 || telo.length > MAX_VSTUP) return null;
    return telo;
  }

  const cil = path.resolve(UPLOADS, soubor);
  const koren = path.resolve(UPLOADS);
  if (cil !== path.join(koren, soubor)) return null;
  const stat = await fs.stat(cil);
  if (!stat.isFile() || stat.size < 32 || stat.size > MAX_VSTUP) return null;
  return fs.readFile(cil);
}
