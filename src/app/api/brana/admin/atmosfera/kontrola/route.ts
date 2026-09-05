import { NextResponse } from "next/server";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { spustitAtmosferaKontrolu } from "@/lib/brana/admin/atmosfera-motor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Jednorázové spuštění motoru Atmosféry (pouze přihlášený admin).
 * Nic nevykresluje návštěvníkům. Žádný cron.
 */
export async function POST() {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  try {
    const vysledek = await spustitAtmosferaKontrolu();
    return NextResponse.json(
      {
        uspech: true,
        stav: vysledek.dokument.stav,
        verejnaVeta: vysledek.verejnaVeta,
        zkontrolovanoAt: vysledek.dokument.zkontrolovanoAt,
        snimekAt: vysledek.dokument.snimekAt,
        predchoziSnimekAt: vysledek.dokument.predchoziSnimekAt,
        model: vysledek.dokument.model,
        duvodStavu: vysledek.dokument.duvodStavu,
        pouzitPredchozi: vysledek.pouzitPredchozi,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Kontrola Atmosféry selhala";
    return NextResponse.json(
      { uspech: false, chyba: detail },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
