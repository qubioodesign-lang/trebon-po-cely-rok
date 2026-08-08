import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { vyhodnotitBranaCasovyPlanProScheduler } from "@/lib/brana/admin/casovy-motor-uloziste";
import { skenovatRychleZdrojeAutomaticky } from "@/lib/brana/admin/skenovat-rychle-zdroje-automaticky";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron trigger:
 * ověří CRON_SECRET → časový motor → při jeRychlyTermin sekvenční Rychlý scan.
 * Bez push, bez Dlouhodobého scanu, bez posunu +21 dní.
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

  try {
    const vysledek = await vyhodnotitBranaCasovyPlanProScheduler();
    if (!vysledek.ok) {
      return NextResponse.json(
        { ok: false, chyba: "Časový plán se nepodařilo vyhodnotit." },
        { status: 500 },
      );
    }

    const { jeRychlyTermin, jeDlouhodobyTermin } = vysledek.plan;

    if (!jeRychlyTermin) {
      return NextResponse.json({
        ok: true,
        jeRychlyTermin,
        jeDlouhodobyTermin,
        rychlyScan: null,
      });
    }

    const rychlyScan = await skenovatRychleZdrojeAutomaticky();

    return NextResponse.json({
      ok: true,
      jeRychlyTermin,
      jeDlouhodobyTermin,
      rychlyScan,
    });
  } catch {
    return NextResponse.json(
      { ok: false, chyba: "Časový plán nebo Rychlý scan se nepodařilo dokončit." },
      { status: 500 },
    );
  }
}
