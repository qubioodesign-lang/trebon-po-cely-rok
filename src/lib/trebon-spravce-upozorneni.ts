/** Pevný text správcovského upozornění. Bez obsahu vzkazu. */
export const TREBON_VZKAZ_UPOZORNENI_PAYLOAD = {
  title: "Třeboň po celý rok",
  body: "Vzkaz",
} as const;

/** Ruční test. Není to text oznámení na skutečný vzkaz. */
export const TREBON_TESTOVACI_PUSH_PAYLOAD = {
  title: "Třeboň po celý rok",
  body: "Testovací upozornění funguje.",
} as const;

export const TREBON_TEST_NEPLATNA_SUBSCRIPTION =
  "Subscription už není platná. Vypněte a znovu zapněte upozornění na tomto telefonu.";

export const TREBON_SPRAVCE_SW_CESTA = "/admin/sw.js";
export const TREBON_SPRAVCE_SW_SCOPE = "/admin/";

export type TrebonSpravcePushStav = "neposlan" | "odeslan";

export type TrebonSpravcePushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type TrebonSpravceUpozorneniDokument = {
  upozorneniAktivni: boolean;
  pushSubscription: TrebonSpravcePushSubscription | null;
};

type Nacteni =
  | { ok: true; dokument: TrebonSpravceUpozorneniDokument }
  | { ok: false };

export type ZavislostiTrebonSpravceUpozorneni = {
  nacist: () => Promise<Nacteni>;
  odeslat: (
    subscription: TrebonSpravcePushSubscription,
    payload: typeof TREBON_VZKAZ_UPOZORNENI_PAYLOAD,
  ) => Promise<{ uspech: boolean }>;
};

export function validovatTrebonSpravceSubscription(
  hodnota: unknown,
):
  | { ok: true; pushSubscription: TrebonSpravcePushSubscription }
  | { ok: false; chyba: string } {
  if (!hodnota || typeof hodnota !== "object") {
    return { ok: false, chyba: "Push subscription není platná." };
  }
  const raw = hodnota as Record<string, unknown>;
  if (typeof raw.endpoint !== "string" || !raw.endpoint.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný endpoint." };
  }
  if (
    !(
      raw.expirationTime === null ||
      (typeof raw.expirationTime === "number" &&
        Number.isFinite(raw.expirationTime))
    )
  ) {
    return { ok: false, chyba: "Push subscription má neplatný expirationTime." };
  }
  if (!raw.keys || typeof raw.keys !== "object") {
    return { ok: false, chyba: "Push subscription nemá platné klíče." };
  }
  const keys = raw.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || !keys.p256dh.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný klíč p256dh." };
  }
  if (typeof keys.auth !== "string" || !keys.auth.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný klíč auth." };
  }
  return {
    ok: true,
    pushSubscription: {
      endpoint: raw.endpoint.trim(),
      expirationTime: raw.expirationTime as number | null,
      keys: {
        p256dh: keys.p256dh.trim(),
        auth: keys.auth.trim(),
      },
    },
  };
}

/**
 * Jeden pokus na uloženou správcovskou subscription Třeboně.
 * Neplatné přihlášení nemaže. Návštěvnické odběry nečte.
 */
export async function odeslatTrebonSpravceUpozorneniS(
  deps: ZavislostiTrebonSpravceUpozorneni,
): Promise<{ stav: TrebonSpravcePushStav }> {
  const nacist = await deps.nacist();
  if (!nacist.ok) {
    console.error("[trebon-vzkaz-push] nastavení se nepodařilo načíst");
    return { stav: "neposlan" };
  }

  if (!nacist.dokument.upozorneniAktivni || !nacist.dokument.pushSubscription) {
    return { stav: "neposlan" };
  }

  const validace = validovatTrebonSpravceSubscription(
    nacist.dokument.pushSubscription,
  );
  if (!validace.ok) {
    console.error("[trebon-vzkaz-push] neplatná subscription");
    return { stav: "neposlan" };
  }

  try {
    const odeslani = await deps.odeslat(
      validace.pushSubscription,
      TREBON_VZKAZ_UPOZORNENI_PAYLOAD,
    );
    return { stav: odeslani.uspech ? "odeslan" : "neposlan" };
  } catch (error) {
    console.error("[trebon-vzkaz-push] odeslání selhalo", error);
    return { stav: "neposlan" };
  }
}

export type TrebonTestovaciPushVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

type VysledekTestovacihoOdeslani = {
  uspech: boolean;
  statusCode?: number;
};

export type ZavislostiTrebonTestovacihoUpozorneni = {
  prihlasen: boolean;
  nacist: ZavislostiTrebonSpravceUpozorneni["nacist"];
  odeslat: (
    subscription: TrebonSpravcePushSubscription,
    payload: typeof TREBON_TESTOVACI_PUSH_PAYLOAD,
  ) => Promise<VysledekTestovacihoOdeslani>;
};

/**
 * Jeden ruční test na uloženou správcovskou subscription Třeboně.
 * Nevytváří vzkaz a při 404/410 uložený odběr nemaže.
 */
export async function odeslatTrebonTestovaciUpozorneniS(
  deps: ZavislostiTrebonTestovacihoUpozorneni,
): Promise<TrebonTestovaciPushVysledek> {
  if (!deps.prihlasen) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const nacist = await deps.nacist();
  if (!nacist.ok) {
    return {
      uspech: false,
      chyba: "Nastavení upozornění se nepodařilo načíst.",
    };
  }

  if (!nacist.dokument.upozorneniAktivni) {
    return {
      uspech: false,
      chyba: "Upozornění jsou vypnutá. Nejdřív je zapněte na tomto telefonu.",
    };
  }

  if (!nacist.dokument.pushSubscription) {
    return {
      uspech: false,
      chyba:
        "Chybí platná push subscription. Zapněte upozornění na tomto telefonu.",
    };
  }

  const validace = validovatTrebonSpravceSubscription(
    nacist.dokument.pushSubscription,
  );
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const odeslani = await deps.odeslat(
      validace.pushSubscription,
      TREBON_TESTOVACI_PUSH_PAYLOAD,
    );
    if (!odeslani.uspech) {
      if (odeslani.statusCode === 404 || odeslani.statusCode === 410) {
        return { uspech: false, chyba: TREBON_TEST_NEPLATNA_SUBSCRIPTION };
      }
      return {
        uspech: false,
        chyba: "Testovací upozornění se nepodařilo odeslat.",
      };
    }
    return { uspech: true };
  } catch (error) {
    console.error("[trebon-testovaci-push] odeslání selhalo", error);
    return {
      uspech: false,
      chyba: "Testovací upozornění se nepodařilo odeslat.",
    };
  }
}
