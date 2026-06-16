import type { Polozka, PolozkaVerejna, TypObsahu } from "@/types";
import { nacistData, upravitData, seraditPolozky } from "./uloziste-dat";

/** Vrátí všechny aktivní položky seřazené podle pořadí */
export function ziskatAktivniPolozky(): PolozkaVerejna[] {
  const { polozky } = nacistData();

  return seraditPolozky(polozky)
    .filter((p) => p.aktivni)
    .map((p) => ({
      id: p.id,
      typ: p.typ,
      url: `/uploads/${p.soubor}`,
      popis: p.popis,
    }));
}

/** Vrátí všechny položky včetně neaktivních (pro administraci) */
export function ziskatVsechnyPolozky(): Polozka[] {
  const { polozky } = nacistData();
  return seraditPolozky(polozky);
}

/** Vytvoří novou položku */
export function vytvoritPolozku(data: {
  typ: TypObsahu;
  soubor: string;
  popis: string;
  datumPorizeni?: string | null;
}): Polozka {
  const id = crypto.randomUUID();
  const datumPublikace = new Date().toISOString();

  let novaPolozka!: Polozka;

  upravitData((uloziste) => {
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
export function aktualizovatPopis(id: string, popis: string): void {
  upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.popis = popis;
  });
}

/** Přepne viditelnost položky */
export function prepnoutAktivni(id: string, aktivni: boolean): void {
  upravitData((uloziste) => {
    const polozka = uloziste.polozky.find((p) => p.id === id);
    if (polozka) polozka.aktivni = aktivni;
  });
}

/** Smaže položku z úložiště */
export function smazatPolozku(id: string): Polozka | null {
  let smazana: Polozka | null = null;

  upravitData((uloziste) => {
    const index = uloziste.polozky.findIndex((p) => p.id === id);
    if (index === -1) return;
    smazana = uloziste.polozky[index];
    uloziste.polozky.splice(index, 1);
  });

  return smazana;
}

/** Změní pořadí položek podle pole ID */
export function zmenitPoradi(ids: string[]): void {
  upravitData((uloziste) => {
    ids.forEach((id, index) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (polozka) polozka.poradi = index;
    });
  });
}
