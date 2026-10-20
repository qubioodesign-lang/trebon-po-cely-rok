import { NextRequest, NextResponse } from "next/server";
import { BRANA_ANALYTIKA_MAX_TELA_BAJTU } from "@/lib/brana/analytika/model";
import { vytvoritOdpovedPrijmu } from "@/lib/brana/analytika/prijem";
import { zaznamenatBranaAnalytikuDoBlobu } from "@/lib/brana/analytika/uloziste";
import { klasifikovatOblastZHlavicek } from "@/lib/brana/analytika/vercel-geo";
import { klasifikovatZarizeniZUserAgent } from "@/lib/brana/analytika/zarizeni";

export const dynamic = "force-dynamic";

function odpovedOdmitnuti(metoda: string): NextResponse | null {
  const odmitnuti = vytvoritOdpovedPrijmu(metoda);
  if (!odmitnuti) {
    return null;
  }

  return NextResponse.json(odmitnuti.telo, { status: odmitnuti.status });
}

/** Čtení statistik veřejný endpoint nenabízí. */
export async function GET() {
  const odmitnuti = odpovedOdmitnuti("GET");
  return odmitnuti ?? NextResponse.json({ chyba: "Metoda není povolena." }, { status: 405 });
}

/**
 * Příjem dávek. Dokud BRANA_ANALYTIKA_PRIJEM_ZAPNUT není true,
 * požadavek skončí dřív, než se otevře úložiště.
 */
export async function POST(request: NextRequest) {
  const odmitnuti = odpovedOdmitnuti("POST");
  if (odmitnuti) {
    return odmitnuti;
  }

  try {
    const text = await request.text();
    if (text.length > BRANA_ANALYTIKA_MAX_TELA_BAJTU) {
      return NextResponse.json({ chyba: "Příliš velká dávka." }, { status: 400 });
    }

    let telo: unknown;
    try {
      telo = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ chyba: "Neplatná dávka." }, { status: 400 });
    }

    const oblast = klasifikovatOblastZHlavicek(request.headers);
    const zarizeni = klasifikovatZarizeniZUserAgent(request.headers.get("user-agent"));
    const vysledek = await zaznamenatBranaAnalytikuDoBlobu(
      telo,
      undefined,
      oblast,
      zarizeni,
    );
    if (!vysledek.ok) {
      return NextResponse.json({ chyba: "Neplatná dávka." }, { status: 400 });
    }

    return NextResponse.json({ uspech: true });
  } catch {
    return NextResponse.json(
      { chyba: "Analytiku se nepodařilo zapsat." },
      { status: 500 },
    );
  }
}
