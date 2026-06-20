import type { Polozka, PolozkaVerejna, TypObsahu } from "@/types";
import {
  nacistData,
  nacistDataCerstve,
  upravitData,
  seraditPolozky,
} from "./uloziste-dat";
import { sestavitUrlPolozky } from "./url-polozky";

/** Vrátí všechny aktivní položky seřazené podle pořadí */
export async function ziskatAktivniPolozky(
  oidcZHeaderu?: string | null
): Promise<PolozkaVerejna[]> {
  const { polozky } = await nacistData(oidcZHeaderu);

  return seraditPolozky(polozky)
    .filter((p) => p.aktivni)
    .map((p) => ({
      id: p.id,
      typ: p.typ,
      url: sestavitUrlPolozky(p.soubor),
      popis: p.popis,
    }));
}

/** Vrátí všechny položky včetně neaktivních (pro administraci) */
export async function ziskatVsechnyPolozky(
  oidcZHeaderu?: string | null
): Promise<Polozka[]> {
  const { polozky } = await nacistData(oidcZHeaderu);
  return seraditPolozky(polozky);
}

/** Vytvoří novou položku */
export async function vytvoritPolozku(
  data: {
    typ: TypObsahu;
    soubor: string;
    popis: string;
    datumPorizeni?: string | null;
  },
  oidcZHeaderu?: string | null
): Promise<Polozka> {
  const id = crypto.randomUUID();
  const datumPublikace = new Date().toISOString();

  let novaPolozka!: Polozka;

  await upravitData(
    (uloziste) => {
      if (uloziste.polozky.some((p) => p.id === id)) {
        novaPolozka = uloziste.polozky.find((p) => p.id === id)!;
        return;
      }

      const minPoradi = uloziste.polozky.reduce(
        (min, p) => Math.min(min, p.poradi),
        Infinity
      );

      novaPolozka = {
        id,
        typ: data.typ,
        soubor: data.soubor,
        popis: data.popis,
        datumPorizeni: data.datumPorizeni ?? null,
        datumPublikace,
        // Záporné poradi = před stávající fotky bez změny jejich hodnot
        poradi: minPoradi === Infinity ? 0 : minPoradi - 1,
        aktivni: true,
      };

      uloziste.polozky.push(novaPolozka);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.some((p) => p.id === id),
    }
  );

  return novaPolozka;
}

/** Vrátí jednu položku podle ID (bez mazání) */
export async function ziskatPolozku(
  id: string,
  oidcZHeaderu?: string | null
): Promise<Polozka | null> {
  const { polozky } = await nacistData(oidcZHeaderu);
  return polozky.find((p) => p.id === id) ?? null;
}

/** Vrátí položku podle ID – vždy čerstvě z úložiště, bez React cache */
export async function ziskatPolozkuCerstve(
  id: string,
  oidcZHeaderu?: string | null,
  volbyCteni?: { bypassCache?: boolean }
): Promise<Polozka | null> {
  const { polozky } = await nacistDataCerstve(oidcZHeaderu, volbyCteni);
  return polozky.find((p) => p.id === id) ?? null;
}

/** Nahradí soubor existující položky – ostatní metadata zůstanou */
export async function nahraditSouborPolozky(
  id: string,
  novySoubor: string,
  typ: TypObsahu,
  oidcZHeaderu?: string | null
): Promise<Polozka> {
  let nahrazena!: Polozka;

  await upravitData(
    (uloziste) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (!polozka) {
        throw new Error("Položka nebyla nalezena");
      }

      polozka.soubor = novySoubor;
      polozka.typ = typ;
      nahrazena = polozka;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.soubor === novySoubor,
    }
  );

  return nahrazena;
}

/** Aktualizuje popis položky */
export async function aktualizovatPopis(
  id: string,
  popis: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.popis = popis;
  }, oidcZHeaderu);
}

/** Přepne viditelnost položky */
export async function prepnoutAktivni(
  id: string,
  aktivni: boolean,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.aktivni = aktivni;
  }, oidcZHeaderu);
}

/** Smaže položku z úložiště */
export async function smazatPolozku(
  id: string,
  oidcZHeaderu?: string | null
): Promise<Polozka | null> {
  let smazana: Polozka | null = null;

  await upravitData((uloziste) => {
    const index = uloziste.polozky.findIndex((p) => p.id === id);
    if (index === -1) return;
    smazana = uloziste.polozky[index];
    uloziste.polozky.splice(index, 1);
  }, oidcZHeaderu);

  return smazana;
}

/** Změní pořadí položek podle pole ID */
export async function zmenitPoradi(
  ids: string[],
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    ids.forEach((id, index) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (polozka) polozka.poradi = index;
    });
  }, oidcZHeaderu);
}
