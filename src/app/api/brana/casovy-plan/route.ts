import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { vyhodnotitBranaCasovyPlanProScheduler } from "@/lib/brana/admin/casovy-motor-uloziste";
import { vyhodnotitAOdeslatRychleUpozorneniPoScanu } from "@/lib/brana/admin/odeslat-rychle-upozorneni-automaticky";
import { skenovatRychleZdrojeAutomaticky } from "@/lib/brana/admin/skenovat-rychle-zdroje-automaticky";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron trigger:
 * ověří CRON_SECRET → časový motor → při jeRychlyTermin sekvenční Rychlý scan
 * → případně jedno souhrnné Rychlé Web Push upozornění.
 * Bez Dlouhodobého scanu, bez Pravidelného push, bez +21 dní.
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

    const { jeRychlyTermin, jeDlouhodobyTermin, datumVPraze } = vysledek.plan;

    if (!jeRychlyTermin) {
      return NextResponse.json({
        ok: true,
        jeRychlyTermin,
        jeDlouhodobyTermin,
        rychlyScan: null,
        rychlyPush: null,
      });
    }

    const rychlyScan = await skenovatRychleZdrojeAutomaticky();
    const rychlyPush = await vyhodnotitAOdeslatRychleUpozorneniPoScanu({
      datumVPraze,
      pridanoDoKalendare: rychlyScan.pridanoDoKalendare,
    });

    return NextResponse.json({
      ok: true,
      jeRychlyTermin,
      jeDlouhodobyTermin,
      rychlyScan,
      rychlyPush,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        chyba:
          "Časový plán, Rychlý scan nebo zápis po Rychlém upozornění se nepodařilo dokončit.",
      },
      { status: 500 },
    );
  }
}
