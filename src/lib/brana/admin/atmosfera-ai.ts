import "server-only";

import { jeNocniRezimVPraze } from "@/lib/brana/cas";
import {
  jeAtmosferaStav,
  povoleneStavyKlasifikace,
  type BranaAtmosferaStav,
} from "../atmosfera";

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
- při nejistotě NIC.`;

const DOPLNENI_ZTICHLE = `ZTICHLE znamená, že náměstí podle aktuálního obrazu působí téměř opuštěně, s minimem viditelné lidské aktivity.
Samotná tma ani denní doba nejsou důkazem stavu ZTICHLE.
KLIDNE zůstává běžný poklidný stav náměstí.`;

export function systemPromptKlasifikace(nocniRezim: boolean): string {
  const povolene = povoleneStavyKlasifikace(nocniRezim);
  const seznam = povolene.join(", ");
  const json = povolene.map((stav) => `"${stav}"`).join("|");
  const doplneni = nocniRezim ? `\n${DOPLNENI_ZTICHLE}\n` : "\n";

  return `${SYSTEM_PROMPT_ZAKLAD}

Dostáváš POUZE aktuální snímek.
Povolené stavy: ${seznam}.${doplneni}
Vrať JSON: {"stav":${json}}`;
}

function schema(nocniRezim: boolean) {
  return {
    type: "json_schema" as const,
    name: "brana_atmosfera",
    strict: true,
    schema: {
      type: "object",
      properties: {
        stav: {
          type: "string",
          enum: [...povoleneStavyKlasifikace(nocniRezim)],
        },
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
  nocniRezim: boolean,
): BranaAtmosferaStav | null {
  try {
    const json = JSON.parse(text) as { stav?: unknown };
    if (!jeAtmosferaStav(json.stav)) return null;
    if (!povoleneStavyKlasifikace(nocniRezim).includes(json.stav)) return null;
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
}): Promise<BranaAtmosferaAiVysledek> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new BranaAtmosferaAiChyba("Chybí OPENAI_API_KEY");
  }

  const nocniRezim = jeNocniRezimVPraze();
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: "Jediný obrázek = aktuální snímek. Vrať jen JSON {\"stav\":\"...\"}.",
    },
    {
      type: "input_image",
      image_url: `data:image/jpeg;base64,${args.aktualniJpeg.toString("base64")}`,
      detail: "low",
    },
  ];

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
          content: [
            { type: "input_text", text: systemPromptKlasifikace(nocniRezim) },
          ],
        },
        { role: "user", content },
      ],
      text: { format: schema(nocniRezim) },
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

  const stav = parsovatStavZTextu(text, nocniRezim);
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
