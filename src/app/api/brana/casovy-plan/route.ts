import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { vyhodnotitBranaCasovyPlanProScheduler } from "@/lib/brana/admin/casovy-motor-uloziste";

export const dynamic = "force-dynamic";

/**
 * Minimální Vercel Cron trigger:
 * ověří CRON_SECRET → zavolá časový motor → vrátí pouze booleany.
 * Bez scanu, push, Blob put a změny stavových polí.
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

    return NextResponse.json({
      ok: true,
      jeRychlyTermin: vysledek.plan.jeRychlyTermin,
      jeDlouhodobyTermin: vysledek.plan.jeDlouhodobyTermin,
    });
  } catch {
    return NextResponse.json(
      { ok: false, chyba: "Časový plán se nepodařilo vyhodnotit." },
      { status: 500 },
    );
  }
}
