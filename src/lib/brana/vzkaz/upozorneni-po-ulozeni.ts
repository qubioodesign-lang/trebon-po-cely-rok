/** Pevný text upozornění na nový vzkaz. Bez obsahu vzkazu a bez odesílatele. */
export const BRANA_VZKAZ_UPOZORNENI_PAYLOAD = {
  title: "BRÁNA",
  body: "Vzkaz",
} as const;

export type BranaVzkazPushStav = "neposlan" | "odeslan";

export type BranaVzkazPushVysledek = {
  stav: BranaVzkazPushStav;
};

type VzkazPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

type NacteniUpozorneni =
  | {
      ok: true;
      dokument: {
        upozorneniAktivni: boolean;
        pushSubscription: unknown;
      };
    }
  | { ok: false };

export type ZavislostiUpozorneniNaVzkaz = {
  maKonfiguraci: () => boolean;
  nacist: () => Promise<NacteniUpozorneni>;
  validovat: (
    hodnota: unknown,
  ) =>
    | { ok: true; pushSubscription: VzkazPushSubscription }
    | { ok: false; chyba: string };
  odeslat: (
    subscription: VzkazPushSubscription,
    payload: typeof BRANA_VZKAZ_UPOZORNENI_PAYLOAD,
  ) => Promise<{ uspech: boolean }>;
};

/**
 * Jeden pokus o push na už uloženou subscription.
 * Nepíše denní razítka skenů a při vypnutých upozorněních nic neposílá.
 */
export async function odeslatUpozorneniNaNovyVzkazS(
  deps: ZavislostiUpozorneniNaVzkaz,
): Promise<BranaVzkazPushVysledek> {
  if (!deps.maKonfiguraci()) {
    console.error(
      "[brana-vzkaz-push] chybí BLOB_BRANA_ADMIN konfigurace – push neodeslán",
    );
    return { stav: "neposlan" };
  }

  const nacist = await deps.nacist();
  if (!nacist.ok) {
    console.error("[brana-vzkaz-push] nastavení se nepodařilo načíst");
    return { stav: "neposlan" };
  }

  if (!nacist.dokument.upozorneniAktivni || !nacist.dokument.pushSubscription) {
    return { stav: "neposlan" };
  }

  const validace = deps.validovat(nacist.dokument.pushSubscription);
  if (!validace.ok) {
    console.error("[brana-vzkaz-push] neplatná subscription");
    return { stav: "neposlan" };
  }

  try {
    const odeslani = await deps.odeslat(
      validace.pushSubscription,
      BRANA_VZKAZ_UPOZORNENI_PAYLOAD,
    );
    return { stav: odeslani.uspech ? "odeslan" : "neposlan" };
  } catch (error) {
    console.error("[brana-vzkaz-push] odeslání selhalo", error);
    return { stav: "neposlan" };
  }
}

/**
 * Nejdřív uložení. Push až po něm.
 * Selhání push se nešíří: volající může dál vrátit úspěch uloženého vzkazu.
 * Když uložení spadne, upozornění se nespustí.
 */
export async function dokoncitUlozeniVzkazu(akce: {
  ulozit: () => Promise<void>;
  upozornit: () => Promise<unknown>;
}): Promise<void> {
  await akce.ulozit();
  try {
    await akce.upozornit();
  } catch (error) {
    console.error("[brana-vzkaz-push] neočekávané selhání", error);
  }
}
