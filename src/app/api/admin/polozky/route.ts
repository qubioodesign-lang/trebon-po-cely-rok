import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAdminData } from "@/lib/admin-data";
import {
  vytvoritPolozku,
  aktualizovatPopis,
  prepnoutAktivni,
  smazatPolozku,
  zmenitPoradi,
} from "@/lib/polozky";
import { ulozitSoubor, smazatSoubor } from "@/lib/soubory";
import { ziskatDiagnozuBlob } from "@/lib/env-blob";

export const dynamic = "force-dynamic";

async function ziskatOidcZHeaderu(): Promise<string | null> {
  const hlavicky = await headers();
  return hlavicky.get("x-vercel-oidc-token");
}

/** Seznam všech položek a metrik (pouze pro admina) */
export async function GET() {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const oidcHeader = await ziskatOidcZHeaderu();

  try {
    const { data, chyby } = await nacistAdminData();
    const status = chyby.polozky || chyby.metriky ? 207 : 200;

    return NextResponse.json(
      {
        ...data,
        chyby,
      },
      { status }
    );
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při načítání dat";
    return NextResponse.json({ chyba: zprava }, { status: 500 });
  }
}

/** Nahrání nové položky */
export async function POST(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const oidcHeader = await ziskatOidcZHeaderu();

  try {
    const formData = await request.formData();
    const soubor = formData.get("soubor") as File | null;
    const popis = (formData.get("popis") as string) ?? "";
    const datumPorizeni = (formData.get("datumPorizeni") as string) || null;

    if (!soubor) {
      return NextResponse.json({ chyba: "Soubor je povinný" }, { status: 400 });
    }

    const { cestaSouboru, typ } = await ulozitSoubor(soubor, oidcHeader);
    const polozka = await vytvoritPolozku(
      {
        typ,
        soubor: cestaSouboru,
        popis,
        datumPorizeni,
      },
      oidcHeader
    );

    return NextResponse.json({
      polozka,
      diagnoza: ziskatDiagnozuBlob(oidcHeader),
    });
  } catch (error) {
    const zprava = error instanceof Error ? error.message : "Chyba při nahrávání";
    return NextResponse.json(
      { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader) },
      { status: 500 }
    );
  }
}

/** Aktualizace položky (popis, viditelnost, pořadí) */
export async function PATCH(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const oidcHeader = await ziskatOidcZHeaderu();
  const body = await request.json();
  const { id, popis, aktivni, poradiIds } = body;

  if (poradiIds && Array.isArray(poradiIds)) {
    await zmenitPoradi(poradiIds, oidcHeader);
    return NextResponse.json({ uspech: true });
  }

  if (!id) {
    return NextResponse.json({ chyba: "Chybí ID položky" }, { status: 400 });
  }

  if (popis !== undefined) {
    await aktualizovatPopis(id, popis, oidcHeader);
  }

  if (aktivni !== undefined) {
    await prepnoutAktivni(id, aktivni, oidcHeader);
  }

  return NextResponse.json({ uspech: true });
}

/** Smazání položky */
export async function DELETE(request: NextRequest) {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const oidcHeader = await ziskatOidcZHeaderu();
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ chyba: "Chybí ID položky" }, { status: 400 });
  }

  const smazana = await smazatPolozku(id, oidcHeader);
  if (smazana) {
    await smazatSoubor(smazana.soubor, oidcHeader);
  }

  return NextResponse.json({ uspech: true });
}
