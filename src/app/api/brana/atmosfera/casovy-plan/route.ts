import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { okamzikVPraze } from "@/lib/brana/cas";
import {
  jeAtmosferaCasovySlot,
  uzProbehlaAtmosferaKontrolaVeStejnemSlotu,
} from "@/lib/brana/admin/atmosfera-casovy-plan";
import { spustitAtmosferaKontrolu } from "@/lib/brana/admin/atmosfera-motor";
import { nacistAtmosferaDokumentPokudExistuje } from "@/lib/brana/admin/atmosfera-uloziste";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron trigger Atmosféry (oddělený od /api/brana/casovy-plan).
 * CRON_SECRET → Pražský slot 8/11/15/19/23 → dedup slotu → jeden běh motoru.
 */

function jePlatnaCronAutorizace(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const predlozeno = Buffer.from(authHeader);
  const ocekavano = Buffer.from(expected);
  if (predlozeno.length !== ocekavano.length) {
    return false;
  }

  return timingSafeEqual(predlozeno, ocekavano);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, chyba: "Scheduler není nakonfigurovaný." },
      { status: 503 },
    );
  }

  if (!jePlatnaCronAutorizace(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, chyba: "Neoprávněný přístup." }, {
      status: 401,
    });
  }

  const ted = new Date();
  const praha = okamzikVPraze(ted);
  const datumVPraze = `${praha.rok}-${pad2(praha.mesic)}-${pad2(praha.den)}`;
  const casVPraze = `${pad2(praha.hodina)}:${pad2(praha.minuta)}`;

  if (!jeAtmosferaCasovySlot(ted)) {
    return NextResponse.json({
      ok: true,
      spusteno: false,
      duvod: "mimo_slot",
      datumVPraze,
      casVPraze,
    });
  }

  try {
    const dokument = await nacistAtmosferaDokumentPokudExistuje();
    if (
      uzProbehlaAtmosferaKontrolaVeStejnemSlotu(
        dokument?.zkontrolovanoAt,
        ted,
      )
    ) {
      return NextResponse.json({
        ok: true,
        spusteno: false,
        duvod: "uz_probehlo_ve_slotu",
        datumVPraze,
        casVPraze,
        zkontrolovanoAt: dokument?.zkontrolovanoAt ?? null,
      });
    }

    const vysledek = await spustitAtmosferaKontrolu();

    return NextResponse.json({
      ok: true,
      spusteno: true,
      datumVPraze,
      casVPraze,
      stav: vysledek.dokument.stav,
      verejnaVeta: vysledek.verejnaVeta,
      zkontrolovanoAt: vysledek.dokument.zkontrolovanoAt,
      duvodStavu: vysledek.dokument.duvodStavu,
      pouzitPredchozi: vysledek.pouzitPredchozi,
    });
  } catch (error) {
    console.error("[brana-atmosfera-casovy-plan] selhání", error);
    return NextResponse.json(
      {
        ok: false,
        chyba: "Kontrola Atmosféry se nepodařila dokončit.",
        datumVPraze,
        casVPraze,
      },
      { status: 500 },
    );
  }
}
