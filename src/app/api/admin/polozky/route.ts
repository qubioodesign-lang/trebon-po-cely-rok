import { NextRequest, NextResponse } from "next/server";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  ziskatVsechnyPolozky,
  vytvoritPolozku,
  aktualizovatPopis,
  prepnoutAktivni,
  smazatPolozku,
  zmenitPoradi,
} from "@/lib/polozky";
import { ulozitSoubor, smazatSoubor } from "@/lib/soubory";
import { ziskatSouhrnMetrik } from "@/lib/metriky";
import { pouzivaBlobUloziste } from "@/lib/uloziste-dat";

/** Seznam všech položek a metrik (pouze pro admina) */
export async function GET() {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const polozky = await ziskatVsechnyPolozky();
  const metriky = await ziskatSouhrnMetrik();

  return NextResponse.json({
    polozky,
    metriky,
    trvaleUloziste: pouzivaBlobUloziste(),
  });
}

/** Nahrání nové položky */
export async function POST(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const soubor = formData.get("soubor") as File | null;
    const popis = (formData.get("popis") as string) ?? "";
    const datumPorizeni = (formData.get("datumPorizeni") as string) || null;

    if (!soubor) {
      return NextResponse.json({ chyba: "Soubor je povinný" }, { status: 400 });
    }

    const { cestaSouboru, typ } = await ulozitSoubor(soubor);
    const polozka = await vytvoritPolozku({
      typ,
      soubor: cestaSouboru,
      popis,
      datumPorizeni,
    });

    return NextResponse.json({ polozka });
  } catch (error) {
    const zprava = error instanceof Error ? error.message : "Chyba při nahrávání";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}

/** Aktualizace položky (popis, viditelnost, pořadí) */
export async function PATCH(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const body = await request.json();
  const { id, popis, aktivni, poradiIds } = body;

  if (poradiIds && Array.isArray(poradiIds)) {
    await zmenitPoradi(poradiIds);
    return NextResponse.json({ uspech: true });
  }

  if (!id) {
    return NextResponse.json({ chyba: "Chybí ID položky" }, { status: 400 });
  }

  if (popis !== undefined) {
    await aktualizovatPopis(id, popis);
  }

  if (aktivni !== undefined) {
    await prepnoutAktivni(id, aktivni);
  }

  return NextResponse.json({ uspech: true });
}

/** Smazání položky */
export async function DELETE(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ chyba: "Chybí ID položky" }, { status: 400 });
  }

  const smazana = await smazatPolozku(id);
  if (smazana) {
    await smazatSoubor(smazana.soubor);
  }

  return NextResponse.json({ uspech: true });
}
