import "server-only";

import {
  jeAtmosferaDynamickyStav,
  jeAtmosferaStatickyStav,
  jeAtmosferaStav,
  type BranaAtmosferaStav,
} from "./atmosfera";

export const BRANA_ATMOSFERA_OPENAI_URL =
  "https://api.openai.com/v1/responses";
export const BRANA_ATMOSFERA_MODEL = "gpt-5.4-mini";

export class BranaAtmosferaAiChyba extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = "BranaAtmosferaAiChyba";
  }
}

const SYSTEM_PROMPT_ZAKLAD = `Jsi klasifikátor Atmosféry náměstí (Třeboň, Masarykovo náměstí).
AI nikdy nevytváří veřejnou větu. Vrať pouze interní stav.

Pravidla:
- nepočítej lidi,
- nerozpoznávej osoby,
- žádné demografické závěry,
- žádné názvy akcí,
- žádné spekulace o příčině,
- počasí samo o sobě není stav,
- množství stánků samo o sobě neznamená RUSNE,
- CHYSTA_SE má přednost při skutečně viditelné přípravě/logistice/změně uspořádání,
- denní doba sama o sobě není důkaz změny,
- při nejistotě NIC.`;

function systemPrompt(maPredchozi: boolean): string {
  if (!maPredchozi) {
    return `${SYSTEM_PROMPT_ZAKLAD}

Dostáváš POUZE aktuální snímek.
Povolené stavy: KLIDNE, ZIVO, RUSNE, CHYSTA_SE, NIC.
Dynamické stavy OZIVA/ZKLIDNUJE/ZTICHLO NEPOUŽÍVEJ.

Vrať JSON: {"stav":"KLIDNE"|"ZIVO"|"RUSNE"|"CHYSTA_SE"|"NIC"}`;
  }

  return `${SYSTEM_PROMPT_ZAKLAD}

Dostáváš aktuální snímek a předchozí pracovní snímek.
Statické stavy: KLIDNE, ZIVO, RUSNE, CHYSTA_SE, NIC.
Dynamické stavy OZIVA, ZKLIDNUJE, ZTICHLO smíš použít JEN při průkazné změně mezi snímky.
Pokud změna není dost jasná, použij statický stav aktuálního snímku nebo NIC.

Vrať JSON: {"stav":"KLIDNE"|"ZIVO"|"RUSNE"|"CHYSTA_SE"|"OZIVA"|"ZKLIDNUJE"|"ZTICHLO"|"NIC"}`;
}

function schema(maPredchozi: boolean) {
  const enumStavy = maPredchozi
    ? [
        "KLIDNE",
        "ZIVO",
        "RUSNE",
        "CHYSTA_SE",
        "OZIVA",
        "ZKLIDNUJE",
        "ZTICHLO",
        "NIC",
      ]
    : ["KLIDNE", "ZIVO", "RUSNE", "CHYSTA_SE", "NIC"];

  return {
    type: "json_schema" as const,
    name: "brana_atmosfera",
    strict: true,
    schema: {
      type: "object",
      properties: {
        stav: { type: "string", enum: enumStavy },
      },
      required: ["stav"],
      additionalProperties: false,
    },
  };
}

function vytahnoutText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) {
    return root.output_text.trim();
  }
  if (!Array.isArray(root.output)) return null;
  for (const polozka of root.output) {
    if (!polozka || typeof polozka !== "object") continue;
    const item = polozka as Record<string, unknown>;
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const cast of item.content) {
      if (!cast || typeof cast !== "object") continue;
      const c = cast as Record<string, unknown>;
      if (typeof c.text === "string" && c.text.trim()) {
        return c.text.trim();
      }
    }
  }
  return null;
}

function parsovatStavZTextu(
  text: string,
  maPredchozi: boolean,
): BranaAtmosferaStav | null {
  try {
    const json = JSON.parse(text) as { stav?: unknown };
    if (!jeAtmosferaStav(json.stav)) return null;
    if (!maPredchozi && jeAtmosferaDynamickyStav(json.stav)) return null;
    if (!maPredchozi && !jeAtmosferaStatickyStav(json.stav)) return null;
    return json.stav;
  } catch {
    return null;
  }
}

export type BranaAtmosferaAiVysledek = {
  stav: BranaAtmosferaStav;
  model: string;
};

export async function klasifikovatAtmosferuObrazy(args: {
  aktualniJpeg: Buffer;
  predchoziJpeg: Buffer | null;
}): Promise<BranaAtmosferaAiVysledek> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new BranaAtmosferaAiChyba("Chybí OPENAI_API_KEY");
  }

  const maPredchozi = args.predchoziJpeg !== null;
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: maPredchozi
        ? "První obrázek = aktuální snímek. Druhý = předchozí pracovní. Vrať jen JSON {\"stav\":\"...\"}."
        : "Jediný obrázek = aktuální snímek. Vrať jen JSON {\"stav\":\"...\"}.",
    },
    {
      type: "input_image",
      image_url: `data:image/jpeg;base64,${args.aktualniJpeg.toString("base64")}`,
      detail: "low",
    },
  ];

  if (args.predchoziJpeg) {
    content.push({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${args.predchoziJpeg.toString("base64")}`,
      detail: "low",
    });
  }

  const odpoved = await fetch(BRANA_ATMOSFERA_OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: BRANA_ATMOSFERA_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt(maPredchozi) }],
        },
        { role: "user", content },
      ],
      text: { format: schema(maPredchozi) },
    }),
  });

  const rawText = await odpoved.text();
  let json: unknown;
  try {
    json = JSON.parse(rawText) as unknown;
  } catch {
    throw new BranaAtmosferaAiChyba(
      `OpenAI neplatná JSON odpověď (HTTP ${odpoved.status})`,
    );
  }

  if (!odpoved.ok) {
    const errObj =
      json && typeof json === "object"
        ? (json as { error?: { message?: string } })
        : null;
    throw new BranaAtmosferaAiChyba(
      errObj?.error?.message?.trim() || `OpenAI HTTP ${odpoved.status}`,
    );
  }

  const text = vytahnoutText(json);
  if (!text) {
    throw new BranaAtmosferaAiChyba("OpenAI nevrátilo textový výstup");
  }

  const stav = parsovatStavZTextu(text, maPredchozi);
  if (!stav) {
    throw new BranaAtmosferaAiChyba("Neplatný AI výstup stavu");
  }

  const model =
    json &&
    typeof json === "object" &&
    typeof (json as { model?: unknown }).model === "string"
      ? ((json as { model: string }).model as string)
      : BRANA_ATMOSFERA_MODEL;

  return { stav, model };
}
