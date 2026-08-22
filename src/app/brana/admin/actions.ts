"use server";

import { revalidatePath } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";
import {
  nastavitPosledniScanDokoncen,
  pridatRucniKonkretniUdalost,
  schvalitKonkretniUdalost,
  schvalitKontroluKonkretnichUdalosti,
  skrytAutomatickouKonkretniUdalost,
  smazatRucniKonkretniUdalost,
  upravitAutomatickouCekaUdalost,
  upravitRucniKonkretniUdalost,
  vyrazitAutomatickouCekaUdalost,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { sestavPevnyKontrolniBlok } from "@/lib/brana/admin/kontrolni-blok";
import { ulozitRedakcniPoradiPatche, nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import {
  BranaRedakcniFieldKonfliktError,
  BranaRedakcniPatchNeplatnyError,
  parsovatRedakcniPoradiPatche,
} from "@/lib/brana/admin/redakcni-poradi-validace";
import { BranaRedakcniCasKonfliktLimitError } from "@/lib/brana/admin/redakcni-poradi-cas";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";
import {
  validovatAutomatickouCekaUpravuVstup,
  validovatRucniUdalostVstup,
} from "@/lib/brana/admin/rucni-udalost-validace";
import {
  skenovatZnamyZdroj,
  type BranaSkenovatZdrojVysledek,
} from "@/lib/brana/admin/skenovat-zdroj";
import { smazatNezarazenyNalez } from "@/lib/brana/admin/nezarazene-uloziste";
import {
  pridatRucniRadarNalez,
  pouzitRadarPracovniStopu,
  smazatRadarPracovniStopu,
} from "@/lib/brana/admin/radar-uloziste";
import { validovatRucniRadarNalezVstup } from "@/lib/brana/admin/radar";
import type { BranaDlouhodobyIntervalDni, BranaZdroj } from "@/lib/brana/admin/zdroj";
import {
  dokumentNaUi,
  nacistUpozorneniNastaveni,
  ulozitPristiDlouhodobouKontrolu,
  ulozitPushSubscription,
  ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku,
  validovatPristiDlouhodobouKontroluVstup,
  validovatPushSubscriptionVstup,
  vypnoutPushSubscription,
  type BranaUpozorneniNastaveniProUi,
} from "@/lib/brana/admin/upozorneni-uloziste";
import { odeslatBranaTestovaciPush } from "@/lib/brana/admin/odeslat-testovaci-push";
import {
  ulozitDlouhodobyIntervalDni,
  validovatDlouhodobyIntervalVstup,
} from "@/lib/brana/admin/zdroje-nastaveni-uloziste";
import {
  pridatZdroj,
  smazatZdroj,
  upravitZdroj,
} from "@/lib/brana/admin/zdroje-uloziste";
import {
  seznamBranaZaloh,
  vytvoritBranaZalohu,
  type BranaZalohaInfo,
} from "@/lib/brana/admin/zaloha";

export type BranaRedakcniUlozitVysledek =
  | { uspech: true; polozky: BranaRedakcniPolozkaStav[] }
  | { uspech: false; chyba: string };

export type BranaRucniUdalostVysledek =
  | { uspech: true; udalost: BranaKonkretniUdalost }
  | { uspech: false; chyba: string };

export type BranaScanStavVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

export type BranaSchvalitKontroluVysledek =
  | { uspech: true; pocetSchvalenych: number }
  | { uspech: false; chyba: string };

export type BranaZdrojeIntervalVysledek =
  | { uspech: true; dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni }
  | { uspech: false; chyba: string };

export type BranaUpozorneniNastaveniVysledek =
  | { uspech: true; ui: BranaUpozorneniNastaveniProUi }
  | { uspech: false; chyba: string };

export type BranaZdrojAkceVysledek =
  | { uspech: true; zdroj: BranaZdroj }
  | { uspech: false; chyba: string };

export type BranaZdrojSmazatVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

export type BranaRadarRucniNalezVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

export type BranaZalohaAkceVysledek =
  | { uspech: true; zaloha: BranaZalohaInfo }
  | { uspech: false; chyba: string };

export type BranaSeznamZalohAkceVysledek =
  | { uspech: true; zalohy: BranaZalohaInfo[] }
  | { uspech: false; chyba: string };

/** Uloží jen změněná pole Redakčního pořadí – pouze pro přihlášeného admina */
export async function ulozitBranaRedakcniPoradiAkce(
  vstup: unknown,
): Promise<BranaRedakcniUlozitVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = parsovatRedakcniPoradiPatche(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const polozky = await ulozitRedakcniPoradiPatche(validace.patche);
    revalidatePath("/brana/admin/sprava/redakcni-poradi");
    return { uspech: true, polozky };
  } catch (error) {
    if (error instanceof BranaRedakcniFieldKonfliktError) {
      return { uspech: false, chyba: error.message };
    }
    if (
      error instanceof BranaRedakcniPatchNeplatnyError ||
      error instanceof BranaRedakcniCasKonfliktLimitError
    ) {
      return { uspech: false, chyba: error.message };
    }
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Změny se neuložily.",
    };
  }
}

/** Označí poslední scan jako dokončený – odemkne ruční zápis v Kalendáři */
export async function oznacitPosledniScanDokoncenAkce(): Promise<BranaScanStavVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await nastavitPosledniScanDokoncen(true);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Stav scanu se nepodařilo uložit.",
    };
  }
}

/** Přidá ruční konkrétní událost do Kalendáře */
export async function pridatRucniKonkretniUdalostAkce(
  vstup: unknown,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const udalost = await pridatRucniKonkretniUdalost(validace.udalost);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se neuložila.",
    };
  }
}

/** Aktualizuje existující ruční událost – stejné id, bez kopie */
export async function upravitRucniKonkretniUdalostAkce(
  id: string,
  vstup: unknown,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const udalost = await upravitRucniKonkretniUdalost(id, validace.udalost);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se neuložila.",
    };
  }
}

/** Smaže jednu ruční událost podle id */
export async function smazatRucniKonkretniUdalostAkce(
  id: string,
): Promise<BranaScanStavVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatRucniKonkretniUdalost(id);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se nepodařilo smazat.",
    };
  }
}

/** Schválí persistovanou událost: CEKA_NA_SCHVALENI → SCHVALENO */
export async function schvalitKonkretniUdalostAkce(
  id: string,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const udalost = await schvalitKonkretniUdalost(id);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se nepodařilo schválit.",
    };
  }
}

/**
 * Hromadně schválí explicitní seznam automatických CEKA (Schválit kontrolu).
 * Fail-closed: neplatné ID → žádný zápis událostí ani schvalenoDoIso.
 * schvalenoDoIso se zapisuje až po úspěšném schválení karet.
 */
export async function schvalitKontroluAkce(
  ids: unknown,
): Promise<BranaSchvalitKontroluVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  if (!Array.isArray(ids)) {
    return { uspech: false, chyba: "Neplatný seznam událostí." };
  }

  try {
    const upozorneni = await nacistUpozorneniNastaveni();
    if (!upozorneni.ok) {
      return {
        uspech: false,
        chyba: "Nastavení upozornění se nepodařilo načíst. Nic nebylo uloženo.",
      };
    }
    const blok = sestavPevnyKontrolniBlok({
      posledniDokoncenaDlouhodobaKontrola:
        upozorneni.dokument.posledniDokoncenaDlouhodobaKontrola,
      pristiDlouhodobaKontrola: upozorneni.dokument.pristiDlouhodobaKontrola,
    });
    if (!blok) {
      return {
        uspech: false,
        chyba: "Kontrolní blok není k dispozici. Nic nebylo uloženo.",
      };
    }

    const vysledek = await schvalitKontroluKonkretnichUdalosti(
      ids as string[],
    );
    await ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso);
    revalidatePath("/brana/admin/sprava/kalendar");
    revalidatePath("/brana/admin/sprava/vyhled");
    return { uspech: true, pocetSchvalenych: vysledek.pocetSchvalenych };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Kontrolu se nepodařilo schválit.",
    };
  }
}

/** Upraví automatickou CEKA/SCHVALENO událost se scanKlic – zachová stávající stav */
export async function upravitAutomatickouCekaUdalostAkce(
  id: string,
  vstup: unknown,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatAutomatickouCekaUpravuVstup(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const udalost = await upravitAutomatickouCekaUdalost(id, validace.uprava);
    revalidatePath("/brana/admin/sprava/kalendar");
    revalidatePath("/brana/admin/sprava/vyhled");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se neuložila.",
    };
  }
}

/** Jednorázově skryje automatickou CEKA/SCHVALENO: fyzicky odstraní záznam. */
export async function skrytAutomatickouKonkretniUdalostAkce(
  id: string,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const udalost = await skrytAutomatickouKonkretniUdalost(id);
    revalidatePath("/brana/admin/sprava/kalendar");
    revalidatePath("/brana/admin/sprava/vyhled");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se nepodařilo skrýt.",
    };
  }
}

/** Vyřadí automatickou CEKA/SCHVALENO → VYRAZENO (záznam zůstává) */
export async function vyrazitAutomatickouCekaUdalostAkce(
  id: string,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const udalost = await vyrazitAutomatickouCekaUdalost(id);
    revalidatePath("/brana/admin/sprava/kalendar");
    revalidatePath("/brana/admin/sprava/vyhled");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se nepodařilo vyřadit.",
    };
  }
}

/** Uloží společný interval kontroly dlouhodobých zdrojů (14 / 21 / 30) */
export async function ulozitBranaZdrojeDlouhodobyIntervalAkce(
  interval: unknown,
): Promise<BranaZdrojeIntervalVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatDlouhodobyIntervalVstup(interval);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const dokument = await ulozitDlouhodobyIntervalDni(
      validace.dlouhodobyIntervalDni,
    );
    revalidatePath("/brana/admin/sprava/zdroje");
    return {
      uspech: true,
      dlouhodobyIntervalDni: dokument.dlouhodobyIntervalDni,
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Interval se nepodařilo uložit.",
    };
  }
}

/** Uloží příští dlouhodobou kontrolu (bez změny push subscription). */
export async function ulozitBranaUpozorneniPristiKontroluAkce(
  pristiDlouhodobaKontrola: unknown,
): Promise<BranaUpozorneniNastaveniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatPristiDlouhodobouKontroluVstup(
    pristiDlouhodobaKontrola,
  );
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const dokument = await ulozitPristiDlouhodobouKontrolu(
      validace.pristiDlouhodobaKontrola,
    );
    revalidatePath("/brana/admin/sprava/upozorneni");
    return { uspech: true, ui: dokumentNaUi(dokument) };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Nastavení upozornění se nepodařilo uložit.",
    };
  }
}

/** Uloží / nahradí jedinou PRIVATE PushSubscription a zapne upozornění. */
export async function ulozitBranaPushSubscriptionAkce(
  subscription: unknown,
): Promise<BranaUpozorneniNastaveniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatPushSubscriptionVstup(subscription);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const dokument = await ulozitPushSubscription(validace.pushSubscription);
    revalidatePath("/brana/admin/sprava/upozorneni");
    return { uspech: true, ui: dokumentNaUi(dokument) };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Push subscription se nepodařilo uložit.",
    };
  }
}

/** Vypne upozornění a odstraní PRIVATE PushSubscription. */
export async function vypnoutBranaPushSubscriptionAkce(): Promise<BranaUpozorneniNastaveniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const dokument = await vypnoutPushSubscription();
    revalidatePath("/brana/admin/sprava/upozorneni");
    return { uspech: true, ui: dokumentNaUi(dokument) };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Upozornění se nepodařilo vypnout.",
    };
  }
}

export type BranaTestovaciPushAkceVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

/** Ručně odešle jedno testovací Web Push na PRIVATE BRÁNA subscription. */
export async function odeslatBranaTestovaciPushAkce(): Promise<BranaTestovaciPushAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  return odeslatBranaTestovaciPush();
}

export type BranaSkenovatZdrojAkceVysledek =
  | ({ uspech: true } & BranaSkenovatZdrojVysledek)
  | { uspech: false; chyba: string };

/**
 * Ruční scan jednoho známého zdroje.
 * Klient předá pouze id – URL bere server z data/brana-zdroje.json.
 */
export async function skenovatBranaZdrojAkce(
  zdrojId: string,
): Promise<BranaSkenovatZdrojAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const vysledek = await skenovatZnamyZdroj(zdrojId);
    revalidatePath("/brana/admin/sprava/zdroje");
    revalidatePath("/brana/admin/sprava/kalendar");
    revalidatePath("/brana/admin/sprava/nezarazene");
    return { uspech: true, ...vysledek };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Scan zdroje se nepodařil.",
    };
  }
}

export type BranaNezarazeneSmazatVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

/** Smazat otevřený nezařazený nález (+ paměť klíče proti opětovnému NO-MATCH). */
export async function smazatBranaNezarazenyNalezAkce(
  id: string,
): Promise<BranaNezarazeneSmazatVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatNezarazenyNalez(id);
    revalidatePath("/brana/admin/sprava/nezarazene");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Nález se nepodařilo smazat.",
    };
  }
}

/** Přidá známý zdroj do produkčního seznamu */
export async function pridatBranaZdrojAkce(
  vstup: unknown,
): Promise<BranaZdrojAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const redakcni = await nacistRedakcniPoradi();
    const povolene = redakcni.ok
      ? new Set(redakcni.polozky.map((p) => p.id))
      : undefined;
    const zdroj = await pridatZdroj(
      vstup,
      povolene ? { povoleneRedakcniPolozkaIds: povolene } : undefined,
    );
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true, zdroj };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se neuložil.",
    };
  }
}

/** Upraví existující známý zdroj – stejné id */
export async function upravitBranaZdrojAkce(
  id: string,
  vstup: unknown,
): Promise<BranaZdrojAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const redakcni = await nacistRedakcniPoradi();
    const povolene = redakcni.ok
      ? new Set(redakcni.polozky.map((p) => p.id))
      : undefined;
    const zdroj = await upravitZdroj(
      id,
      vstup,
      povolene ? { povoleneRedakcniPolozkaIds: povolene } : undefined,
    );
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true, zdroj };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se neuložil.",
    };
  }
}

/** Smaže jeden známý zdroj podle id */
export async function smazatBranaZdrojAkce(
  id: string,
): Promise<BranaZdrojSmazatVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatZdroj(id);
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se nepodařilo smazat.",
    };
  }
}

/** Uloží ruční nález pouze do historie RADARU. Nic nepublikuje. */
export async function pridatRucniRadarNalezAkce(
  vstup: unknown,
): Promise<BranaRadarRucniNalezVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatRucniRadarNalezVstup(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    await pridatRucniRadarNalez(validace.nalez);
    revalidatePath("/brana/admin/sprava/radar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Nález se nepodařilo uložit.",
    };
  }
}

export type BranaRadarStopaAkceVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

/** Použít pracovní stopu: jen historie RADARU, nic se nepublikuje. */
export async function pouzitBranaRadarStopuAkce(
  id: string,
): Promise<BranaRadarStopaAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await pouzitRadarPracovniStopu(id);
    revalidatePath("/brana/admin/sprava/radar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Stopu se nepodařilo použít.",
    };
  }
}

/** Smazat pracovní stopu: jen otisk, nic se nepublikuje. */
export async function smazatBranaRadarStopuAkce(
  id: string,
): Promise<BranaRadarStopaAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatRadarPracovniStopu(id);
    revalidatePath("/brana/admin/sprava/radar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Stopu se nepodařilo smazat.",
    };
  }
}

/** Ruční záloha pěti JSON dokumentů BRÁNY do PRIVATE store. */
export async function vytvoritBranaZalohuAkce(): Promise<BranaZalohaAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const zaloha = await vytvoritBranaZalohu("manual");
    revalidatePath("/brana/admin/sprava/zaloha");
    return { uspech: true, zaloha };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zálohu se nepodařilo vytvořit.",
    };
  }
}

export async function nacistSeznamBranaZalohAkce(): Promise<BranaSeznamZalohAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const zalohy = await seznamBranaZaloh();
    return { uspech: true, zalohy };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Seznam záloh se nepodařilo načíst.",
    };
  }
}
