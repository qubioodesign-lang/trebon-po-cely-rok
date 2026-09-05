import { NextResponse } from "next/server";
import { jeAdminPrihlasen } from "@/lib/autentizace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KAMERA_URL =
  "https://www.webcamlive.cz/camera_image.php?idCamera=1016";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-mini";
const POVOLENE = new Set(["A", "C", "D", "E", "NIC"] as const);

type AtmosferaTestVysledek = "A" | "C" | "D" | "E" | "NIC";

const SYSTEM_PROMPT = `Jsi klasifikátor Atmosféry náměstí (Třeboň, Masarykovo náměstí).
Hodnotíš POUZE jeden aktuální snímek webkamery.
Vrať právě jednu hodnotu ze seznamu: A, C, D, E, NIC.

Významy:
A = Náměstí je klidné.
C = Na náměstí je živo.
D = Náměstí je rušné.
E = Náměstí se chystá.
NIC = nelze bezpečně rozhodnout / snímek nečitelný / nejistota.

Pravidla:
- nepočítej lidi,
- nerozpoznávej osoby,
- žádné demografické závěry,
- žádné názvy akcí,
- žádné vysvětlování,
- počasí samo o sobě není stav,
- množství stánků samo o sobě neznamená D,
- E pouze při skutečně viditelné přípravě/logistice/změně uspořádání,
- B/F/G nepoužívej (vyžadují porovnání snímků),
- při nejistotě NIC.

Odpověz výhradně jedním JSON objektem: {"vysledek":"A"|"C"|"D"|"E"|"NIC"}`;

function parsovatTimestampZUrl(url: string): string | null {
  const m = url.match(/(\d{14})_\d+/);
  if (!m?.[1]) return null;
  const t = m[1];
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`;
}

function validovatVysledek(hodnota: unknown): AtmosferaTestVysledek | null {
  if (typeof hodnota !== "string") return null;
  const v = hodnota.trim().toUpperCase();
  if (POVOLENE.has(v as AtmosferaTestVysledek)) {
    return v as AtmosferaTestVysledek;
  }
  return null;
}

function vytahnoutVysledekZOdpovedi(data: unknown): AtmosferaTestVysledek | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  if (typeof root.output_text === "string") {
    const zTextu = parsovatVysledekZTextu(root.output_text);
    if (zTextu) return zTextu;
  }

  if (Array.isArray(root.output)) {
    for (const polozka of root.output) {
      if (!polozka || typeof polozka !== "object") continue;
      const item = polozka as Record<string, unknown>;
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const cast of item.content) {
        if (!cast || typeof cast !== "object") continue;
        const c = cast as Record<string, unknown>;
        if (typeof c.text === "string") {
          const z = parsovatVysledekZTextu(c.text);
          if (z) return z;
        }
      }
    }
  }

  return null;
}

function parsovatVysledekZTextu(text: string): AtmosferaTestVysledek | null {
  const trim = text.trim();
  const primo = validovatVysledek(trim);
  if (primo) return primo;

  try {
    const json = JSON.parse(trim) as { vysledek?: unknown };
    const zJson = validovatVysledek(json.vysledek);
    if (zJson) return zJson;
  } catch {
    /* pokračuj regexem */
  }

  const m = trim.match(/\b(A|C|D|E|NIC)\b/i);
  return m ? validovatVysledek(m[1]) : null;
}

function vytahnoutUsage(data: unknown): Record<string, number> | null {
  if (!data || typeof data !== "object") return null;
  const usage = (data as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;

  const vysledek: Record<string, number> = {};
  for (const [klic, hodnota] of Object.entries(usage as Record<string, unknown>)) {
    if (typeof hodnota === "number" && Number.isFinite(hodnota)) {
      vysledek[klic] = hodnota;
    } else if (hodnota && typeof hodnota === "object") {
      for (const [vnitrni, v] of Object.entries(
        hodnota as Record<string, unknown>,
      )) {
        if (typeof v === "number" && Number.isFinite(v)) {
          vysledek[`${klic}.${vnitrni}`] = v;
        }
      }
    }
  }
  return Object.keys(vysledek).length > 0 ? vysledek : null;
}

async function nacistSnimekKamery(): Promise<{
  dataUrl: string;
  finalUrl: string;
  timestampSnimku: string | null;
  velikostBajtu: number;
}> {
  const odpoved = await fetch(KAMERA_URL, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      "User-Agent": "BranaAtmosferaTest/1.0",
      Accept: "image/jpeg,image/*;q=0.9,*/*;q=0.1",
    },
  });

  if (!odpoved.ok) {
    throw new Error(`Kamera HTTP ${odpoved.status}`);
  }

  const contentType = (odpoved.headers.get("content-type") ?? "").toLowerCase();
  const buffer = Buffer.from(await odpoved.arrayBuffer());
  if (buffer.length < 100 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Kamera nevrátila platný JPEG");
  }
  if (contentType && !contentType.includes("jpeg") && !contentType.includes("jpg")) {
    // některé CDN nehlásí image/jpeg spolehlivě; magické bajty už ověřeny
  }

  const finalUrl = odpoved.url || KAMERA_URL;
  const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  return {
    dataUrl,
    finalUrl,
    timestampSnimku: parsovatTimestampZUrl(finalUrl),
    velikostBajtu: buffer.byteLength,
  };
}

/** Jednorázový admin test Atmosféry: kamera → OpenAI Responses. Nic neukládá. */
export async function GET() {
  if (!(await jeAdminPrihlasen())) {
    return NextResponse.json({ chyba: "Neautorizováno" }, { status: 401 });
  }

  const casTestu = new Date().toISOString();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        chyba: "Chybí OPENAI_API_KEY",
        vysledek: "NIC",
        model: MODEL,
        casTestu,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let snimek: Awaited<ReturnType<typeof nacistSnimekKamery>>;
  try {
    snimek = await nacistSnimekKamery();
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Kamera selhala";
    return NextResponse.json(
      {
        chyba: detail,
        vysledek: "NIC",
        model: MODEL,
        casTestu,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  let openaiJson: unknown;
  try {
    const openaiOdpoved = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Klasifikuj tento snímek. Vrať jen JSON {\"vysledek\":\"...\"}.",
              },
              {
                type: "input_image",
                image_url: snimek.dataUrl,
                detail: "low",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "atmosfera_test",
            strict: true,
            schema: {
              type: "object",
              properties: {
                vysledek: {
                  type: "string",
                  enum: ["A", "C", "D", "E", "NIC"],
                },
              },
              required: ["vysledek"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const text = await openaiOdpoved.text();
    try {
      openaiJson = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json(
        {
          chyba: `OpenAI neplatná JSON odpověď (HTTP ${openaiOdpoved.status})`,
          vysledek: "NIC",
          model: MODEL,
          casTestu,
          timestampSnimku: snimek.timestampSnimku,
          velikostSnimkuBajtu: snimek.velikostBajtu,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!openaiOdpoved.ok) {
      const errObj =
        openaiJson && typeof openaiJson === "object"
          ? (openaiJson as { error?: { message?: string; code?: string } })
          : null;
      const msg =
        errObj?.error?.message?.trim() ||
        `OpenAI HTTP ${openaiOdpoved.status}`;
      return NextResponse.json(
        {
          chyba: msg,
          vysledek: "NIC",
          model: MODEL,
          casTestu,
          timestampSnimku: snimek.timestampSnimku,
          velikostSnimkuBajtu: snimek.velikostBajtu,
          usage: vytahnoutUsage(openaiJson),
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "OpenAI selhalo";
    return NextResponse.json(
      {
        chyba: detail,
        vysledek: "NIC",
        model: MODEL,
        casTestu,
        timestampSnimku: snimek.timestampSnimku,
        velikostSnimkuBajtu: snimek.velikostBajtu,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const vysledek = vytahnoutVysledekZOdpovedi(openaiJson) ?? "NIC";
  const modelZOdpovedi =
    openaiJson &&
    typeof openaiJson === "object" &&
    typeof (openaiJson as { model?: unknown }).model === "string"
      ? ((openaiJson as { model: string }).model as string)
      : MODEL;

  return NextResponse.json(
    {
      vysledek,
      model: modelZOdpovedi,
      casTestu,
      timestampSnimku: snimek.timestampSnimku,
      velikostSnimkuBajtu: snimek.velikostBajtu,
      usage: vytahnoutUsage(openaiJson),
      ...(vysledek === "NIC" && !vytahnoutVysledekZOdpovedi(openaiJson)
        ? { chyba: "Neplatný výstup modelu" }
        : {}),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
