import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { vyhodnotitBranaCasovyPlanProScheduler } from "@/lib/brana/admin/casovy-motor-uloziste";
import { uklidMinulychKonkretnichUdalostiProScheduler } from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { vyhodnotitAOdeslatAsistovaneUpozorneniPredKotvou } from "@/lib/brana/admin/odeslat-asistovane-upozorneni-automaticky";
import { vyhodnotitAOdeslatPravidelneUpozorneniPoCheckpointu } from "@/lib/brana/admin/odeslat-pravidelne-upozorneni-automaticky";
import { vyhodnotitAOdeslatRychleUpozorneniPoScanu } from "@/lib/brana/admin/odeslat-rychle-upozorneni-automaticky";
import { skenovatDlouhodobeZdrojeAutomaticky } from "@/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky";
import { skenovatRychleZdrojeAutomaticky } from "@/lib/brana/admin/skenovat-rychle-zdroje-automaticky";
import {
  sestavitSkupinovyScanStav,
  type BranaSkupinovyScanTyp,
} from "@/lib/brana/admin/skupinovy-scan-stav";
import {
  dokoncitDlouhodobouKontroluProScheduler,
  ulozitPosledniSkupinovyScanProScheduler,
} from "@/lib/brana/admin/upozorneni-uloziste";

async function zaznamenatDokoncenySkupinovyScan(
  typ: BranaSkupinovyScanTyp,
  chybneZdrojeNazvy: readonly string[],
): Promise<void> {
  try {
    await ulozitPosledniSkupinovyScanProScheduler(
      typ,
      sestavitSkupinovyScanStav(chybneZdrojeNazvy),
    );
  } catch (error) {
    console.error(
      `[brana-${typ === "RYCHLY" ? "rychly" : "dlouhodoby"}-scan] stav dokončení se nepodařilo uložit`,
      error,
    );
  }
}

export const dynamic = "force-dynamic";

/**
 * Vercel Cron trigger:
 * ověří CRON_SECRET → časový motor →
 * denní úklid minulých událostí (před early return) →
 * při jeRychlyTermin sekvenční Rychlý scan;
 * při jeDlouhodobyTermin sekvenční Dlouhodobý scan + stavový checkpoint (+21) + Pravidelný push;
 * při jeAsistovanyPripravnyTermin pouze push (kotva − 3 dny), bez scanu;
 * při úspěšném souběhu potlačí Rychlý push ve prospěch Pravidelného.
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

    const {
      jeRychlyTermin,
      jeDlouhodobyTermin,
      jeAsistovanyPripravnyTermin,
      datumVPraze,
    } = vysledek.plan;

    // Denní úklid vždy (i bez scanového termínu); idempotentní při 2× cron/den.
    const uklidMinulych = await uklidMinulychKonkretnichUdalostiProScheduler();

    let asistovanePush = null;
    if (jeAsistovanyPripravnyTermin) {
      try {
        asistovanePush =
          await vyhodnotitAOdeslatAsistovaneUpozorneniPredKotvou({
            datumVPraze,
          });
      } catch (error) {
        console.error("[brana-asistovane-push] neočekávané selhání", error);
        asistovanePush = { stav: "neposlan" as const };
      }
    }

    if (!jeRychlyTermin && !jeDlouhodobyTermin) {
      return NextResponse.json({
        ok: true,
        jeRychlyTermin,
        jeDlouhodobyTermin,
        jeAsistovanyPripravnyTermin,
        uklidMinulych,
        rychlyScan: null,
        rychlyPush: null,
        dlouhodobyScan: null,
        dlouhodobyCheckpoint: null,
        pravidelnyPush: null,
        asistovanePush,
      });
    }

    let rychlyScan = null;
    if (jeRychlyTermin) {
      rychlyScan = await skenovatRychleZdrojeAutomaticky();
      await zaznamenatDokoncenySkupinovyScan(
        "RYCHLY",
        rychlyScan.chybneZdrojeNazvy,
      );
    }

    let dlouhodobyScan = null;
    let dlouhodobyCheckpoint: {
      dokonceno: boolean;
      pristiDlouhodobaKontrola?: string;
    } | null = null;
    let pravidelnyPush = null;
    let pravidelnyCheckpointStavoveDokonceno = false;

    if (jeDlouhodobyTermin) {
      try {
        dlouhodobyScan = await skenovatDlouhodobeZdrojeAutomaticky();
        await zaznamenatDokoncenySkupinovyScan(
          "DLOUHY",
          dlouhodobyScan.chybneZdrojeNazvy,
        );
        const dokonceni =
          await dokoncitDlouhodobouKontroluProScheduler(datumVPraze);
        pravidelnyCheckpointStavoveDokonceno = true;
        dlouhodobyCheckpoint = {
          dokonceno: true,
          pristiDlouhodobaKontrola: dokonceni.pristiDlouhodobaKontrola,
        };
      } catch (error) {
        console.error("[brana-dlouhodoby-checkpoint] fatální selhání", error);
        dlouhodobyCheckpoint = { dokonceno: false };
        pravidelnyPush = null;
      }

      // Push je následné upozornění: jeho selhání nesmí přepsat již dokončený checkpoint.
      if (pravidelnyCheckpointStavoveDokonceno) {
        try {
          pravidelnyPush =
            await vyhodnotitAOdeslatPravidelneUpozorneniPoCheckpointu({
              datumCheckpointu: datumVPraze,
            });
        } catch (error) {
          console.error("[brana-pravidelny-push] neočekávané selhání", error);
          pravidelnyPush = { stav: "neposlan" as const };
        }
      }
    }

    let rychlyPush = null;
    if (jeRychlyTermin) {
      if (pravidelnyCheckpointStavoveDokonceno) {
        // Souběh: Pravidelná kontrola má přednost — Rychlý push se neposílá.
        rychlyPush = { stav: "preskocen" as const };
      } else {
        rychlyPush = await vyhodnotitAOdeslatRychleUpozorneniPoScanu({
          datumVPraze,
          pridanoDoKalendare: rychlyScan?.pridanoDoKalendare ?? 0,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      jeRychlyTermin,
      jeDlouhodobyTermin,
      jeAsistovanyPripravnyTermin,
      uklidMinulych,
      rychlyScan,
      rychlyPush,
      dlouhodobyScan,
      dlouhodobyCheckpoint,
      pravidelnyPush,
      asistovanePush,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        chyba:
          "Časový plán, scan nebo zápis po upozornění se nepodařilo dokončit.",
      },
      { status: 500 },
    );
  }
}
