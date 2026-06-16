import type { Polozka, PolozkaVerejna, TypObsahu } from "@/types";
import {
  nacistData,
  upravitData,
  seraditPolozky,
} from "./uloziste-dat";
import { sestavitUrlPolozky } from "./url-polozky";

/** Vrátí všechny aktivní položky seřazené podle pořadí */
export async function ziskatAktivniPolozky(): Promise<PolozkaVerejna[]> {
  const { polozky } = await nacistData();

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
export async function ziskatVsechnyPolozky(): Promise<Polozka[]> {
  const { polozky } = await nacistData();
  return seraditPolozky(polozky);
}

/** Vytvoří novou položku */
export async function vytvoritPolozku(data: {
  typ: TypObsahu;
  soubor: string;
  popis: string;
  datumPorizeni?: string | null;
}): Promise<Polozka> {
  const id = crypto.randomUUID();
  const datumPublikace = new Date().toISOString();

  let novaPolozka!: Polozka;

  await upravitData((uloziste) => {
    const maxPoradi = uloziste.polozky.reduce(
      (max, p) => Math.max(max, p.poradi),
      -1
    );

    novaPolozka = {
      id,
      typ: data.typ,
      soubor: data.soubor,
      popis: data.popis,
      datumPorizeni: data.datumPorizeni ?? null,
      datumPublikace,
      poradi: maxPoradi + 1,
      aktivni: true,
    };

    uloziste.polozky.push(novaPolozka);
  });

  return novaPolozka;
}

/** Aktualizuje popis položky */
export async function aktualizovatPopis(id: string, popis: string): Promise<void> {
  await upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.popis = popis;
  });
}

/** Přepne viditelnost položky */
export async function prepnoutAktivni(id: string, aktivni: boolean): Promise<void> {
  await upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.aktivni = aktivni;
  });
}

/** Smaže položku z úložiště */
export async function smazatPolozku(id: string): Promise<Polozka | null> {
  let smazana: Polozka | null = null;

  await upravitData((uloziste) => {
    const index = uloziste.polozky.findIndex((p) => p.id === id);
    if (index === -1) return;
    smazana = uloziste.polozky[index];
    uloziste.polozky.splice(index, 1);
  });

  return smazana;
}

/** Změní pořadí položek podle pole ID */
export async function zmenitPoradi(ids: string[]): Promise<void> {
  await upravitData((uloziste) => {
    ids.forEach((id, index) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (polozka) polozka.poradi = index;
    });
  });
}
