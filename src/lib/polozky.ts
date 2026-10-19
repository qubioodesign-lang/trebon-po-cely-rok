import type { Polozka, PolozkaVerejna, TypObsahu } from "@/types";
import {
  nacistData,
  nacistDataCerstve,
  upravitData,
  seraditPolozky,
} from "./uloziste-dat";
import {
  mapovatPolozkuVerejnou,
  normalizovatSouboryProlnuti,
  overitProlnutiPolozkuVMetadatech,
} from "./polozka-soubory";
import {
  jePlatnyPocetSnimkuProlnuti,
  PROLNUTI_MAX_SNIMKU,
  viditelnostNovehoProlnuti,
} from "./prolnuti-snimky";
import {
  jePlatnyCasRotaceProlnuti,
  polozkyVerejneGalerie,
  vysledekPridaniProlnuti,
  vysledekPrepnutiViditelnosti,
  vysledekSmazaniPolozky,
  vysledekSpusteniRotace,
  vysledekRucnihoPresunu,
  vysledekUpravyPolozky,
  vysledekZmenyPoradi,
  type SmerRucnihoPresunu,
  type StavRotacePolozek,
} from "./rotace-prolnuti";
import type { UlozisteDat } from "./uloziste-dat";

function zapsatStavRotace(uloziste: UlozisteDat, stav: StavRotacePolozek): void {
  uloziste.polozky = stav.polozky;
  if (stav.rotaceOd) uloziste.rotaceProlnutiOd = stav.rotaceOd;
  else delete uloziste.rotaceProlnutiOd;
}

/** Vrátí aktivní položky v pořadí, které se právě ukazuje návštěvníkům. */
export async function ziskatAktivniPolozky(
  oidcZHeaderu?: string | null
): Promise<PolozkaVerejna[]> {
  const uloziste = await nacistData(oidcZHeaderu);

  return polozkyVerejneGalerie(
    uloziste.polozky,
    uloziste.rotaceProlnutiOd,
    Date.now()
  ).map(mapovatPolozkuVerejnou);
}

/**
 * Uložené pořadí včetně skrytých položek, bez automatické rotace.
 * Podle něj se určuje poslední publikace pro push. Administrace bere efektivní pořadí.
 */
export async function ziskatVsechnyPolozky(
  oidcZHeaderu?: string | null
): Promise<Polozka[]> {
  const { polozky } = await nacistData(oidcZHeaderu);
  return seraditPolozky(polozky);
}

function vytvoritZakladPolozky(
  uloziste: { polozky: Polozka[] },
  data: {
    typ: TypObsahu;
    popis: string;
    datumPorizeni?: string | null;
  }
): Omit<Polozka, "soubor" | "soubory"> {
  const minPoradi = uloziste.polozky.reduce(
    (min, p) => Math.min(min, p.poradi),
    Infinity
  );

  return {
    id: crypto.randomUUID(),
    typ: data.typ,
    popis: data.popis,
    datumPorizeni: data.datumPorizeni ?? null,
    datumPublikace: new Date().toISOString(),
    poradi: minPoradi === Infinity ? 0 : minPoradi - 1,
    aktivni: true,
  };
}

/** Vytvoří novou položku s jedním souborem */
export async function vytvoritPolozku(
  data: {
    typ: TypObsahu;
    soubor: string;
    popis: string;
    datumPorizeni?: string | null;
  },
  oidcZHeaderu?: string | null
): Promise<Polozka> {
  let novaPolozka!: Polozka;

  await upravitData(
    (uloziste) => {
      const zaklad = vytvoritZakladPolozky(uloziste, data);
      novaPolozka = {
        ...zaklad,
        soubor: data.soubor,
      };
      uloziste.polozky.push(novaPolozka);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.some((p) => p.id === novaPolozka.id),
    }
  );

  return novaPolozka;
}

/** Vytvoří položku typu prolnutí se 2–3 soubory */
export async function vytvoritProlnuti(
  data: {
    soubory: string[];
    popis: string;
    datumPorizeni?: string | null;
    aktivni?: boolean;
  },
  oidcZHeaderu?: string | null
): Promise<Polozka> {
  const soubory = normalizovatSouboryProlnuti(data.soubory);
  if (!jePlatnyPocetSnimkuProlnuti(soubory.length)) {
    throw new Error("Prolnutí musí mít 2 nebo 3 fotografie");
  }

  let novaPolozka!: Polozka;

  await upravitData(
    (uloziste) => {
      const zaklad = vytvoritZakladPolozky(uloziste, {
        typ: "prolnuti",
        popis: data.popis,
        datumPorizeni: data.datumPorizeni,
      });
      novaPolozka = {
        ...zaklad,
        soubory,
        aktivni: viditelnostNovehoProlnuti(data.aktivni),
      };
      const stav = vysledekPridaniProlnuti(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        novaPolozka,
        Date.now()
      );
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        overitProlnutiPolozkuVMetadatech(
          uloziste,
          novaPolozka.id,
          soubory
        ),
      chybovaZprava:
        "Prolnutí se nepodařilo uložit do metadat. Zkuste akci znovu.",
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
      polozka.soubory = undefined;
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
  await upravitData(
    (uloziste) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (polozka) polozka.popis = popis;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.popis === popis,
    }
  );
}

/** Aktualizuje metadata položky (popis, datum, viditelnost) */
export async function aktualizovatPolozku(
  id: string,
  data: {
    popis?: string;
    datumPorizeni?: string | null;
    aktivni?: boolean;
  },
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData(
    (uloziste) => {
      const stav = vysledekUpravyPolozky(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        id,
        data,
        Date.now()
      );
      if (!stav) {
        throw new Error("Položka nebyla nalezena");
      }
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) => {
        const polozka = uloziste.polozky.find((p) => p.id === id);
        if (!polozka) return false;
        if (data.popis !== undefined && polozka.popis !== data.popis) {
          return false;
        }
        if (
          data.datumPorizeni !== undefined &&
          polozka.datumPorizeni !== data.datumPorizeni
        ) {
          return false;
        }
        if (data.aktivni !== undefined && polozka.aktivni !== data.aktivni) {
          return false;
        }
        return true;
      },
    }
  );
}

/** Nahradí jeden snímek prolnutí (A=0, B=1, C=2) */
export async function nahraditSnimekProlnuti(
  id: string,
  indexSnimku: number,
  novySoubor: string,
  oidcZHeaderu?: string | null
): Promise<Polozka> {
  let nahrazena!: Polozka;

  await upravitData(
    (uloziste) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (!polozka) {
        throw new Error("Položka nebyla nalezena");
      }
      if (polozka.typ !== "prolnuti" || !polozka.soubory) {
        throw new Error("Položka není prolnutí");
      }

      const soubory = normalizovatSouboryProlnuti(polozka.soubory);
      const jeDoplneni =
        indexSnimku === soubory.length && soubory.length < PROLNUTI_MAX_SNIMKU;

      if (
        indexSnimku < 0 ||
        indexSnimku > soubory.length ||
        (indexSnimku === soubory.length && !jeDoplneni)
      ) {
        throw new Error("Neplatný snímek prolnutí");
      }

      const noveSoubory = [...soubory];
      if (jeDoplneni) {
        noveSoubory.push(novySoubor);
      } else {
        noveSoubory[indexSnimku] = novySoubor;
      }

      if (!jePlatnyPocetSnimkuProlnuti(noveSoubory.length)) {
        throw new Error("Prolnutí musí mít 2 nebo 3 fotografie");
      }

      polozka.soubory = noveSoubory;
      nahrazena = polozka;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.soubory?.[indexSnimku] ===
        novySoubor,
    }
  );

  return nahrazena;
}

/** Přepne viditelnost položky */
export async function prepnoutAktivni(
  id: string,
  aktivni: boolean,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData(
    (uloziste) => {
      const stav = vysledekPrepnutiViditelnosti(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        id,
        aktivni,
        Date.now()
      );
      if (!stav) return;
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.aktivni === aktivni,
    }
  );
}

/** Smaže položku z úložiště */
export async function smazatPolozku(
  id: string,
  oidcZHeaderu?: string | null
): Promise<Polozka | null> {
  let smazana: Polozka | null = null;

  await upravitData(
    (uloziste) => {
      const index = uloziste.polozky.findIndex((p) => p.id === id);
      if (index === -1) return;
      smazana = uloziste.polozky[index];
      const stav = vysledekSmazaniPolozky(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        id,
        Date.now()
      );
      if (!stav) return;
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        !uloziste.polozky.some((p) => p.id === id),
      chybovaZprava: "Položku se nepodařilo smazat z metadat. Zkuste akci znovu.",
    }
  );

  return smazana;
}

function chybaZastarelehoPresunu(): Error {
  const error = new Error(
    "Pořadí galerie se mezitím změnilo. Obnovte administraci a proveďte přesun znovu."
  );
  (error as Error & { bezOpakovani?: boolean }).bezOpakovani = true;
  return error;
}

/**
 * Posune jednu položku v pořadí, které právě platí.
 * Šipka ani připnutí neberou celý seznam z otevřené stránky.
 */
export async function presunoutPolozku(
  id: string,
  smer: SmerRucnihoPresunu,
  oidcZHeaderu?: string | null
): Promise<string[]> {
  const now = Date.now();
  const aktualni = await nacistDataCerstve(oidcZHeaderu);
  const nahled = vysledekRucnihoPresunu(
    aktualni.polozky,
    aktualni.rotaceProlnutiOd,
    id,
    smer,
    now
  );
  if (nahled === "chybi") {
    throw new Error("Položka nebyla nalezena");
  }
  if (nahled === "kraj") {
    throw chybaZastarelehoPresunu();
  }

  const ocekavaneIds = nahled.polozky.map((polozka) => polozka.id);
  await upravitData(
    (uloziste) => {
      const stav = vysledekRucnihoPresunu(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        id,
        smer,
        now
      );
      if (stav === "chybi" || stav === "kraj") {
        throw chybaZastarelehoPresunu();
      }
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        ocekavaneIds.every(
          (polozkaId, index) =>
            uloziste.polozky.find((polozka) => polozka.id === polozkaId)?.poradi ===
            index
        ),
    }
  );

  return ocekavaneIds;
}

/**
 * Celý seznam se zapíše jen tehdy, když je to jeden přesun vůči aktuálnímu pořadí.
 * Starý seznam z prohlížeče se odmítne a nic se neuloží.
 */
export async function zmenitPoradi(
  ids: string[],
  oidcZHeaderu?: string | null
): Promise<void> {
  const now = Date.now();
  const aktualni = await nacistDataCerstve(oidcZHeaderu);
  const nahled = vysledekZmenyPoradi(
    aktualni.polozky,
    aktualni.rotaceProlnutiOd,
    ids,
    now
  );
  if (nahled === "odmitnuto") {
    throw chybaZastarelehoPresunu();
  }
  if (nahled === "bezeZmeny") return;

  await upravitData(
    (uloziste) => {
      const stav = vysledekZmenyPoradi(
        uloziste.polozky,
        uloziste.rotaceProlnutiOd,
        ids,
        now
      );
      if (stav === "odmitnuto" || stav === "bezeZmeny") {
        throw chybaZastarelehoPresunu();
      }
      zapsatStavRotace(uloziste, stav);
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        ids.every(
          (id, index) =>
            uloziste.polozky.find((p) => p.id === id)?.poradi === index
        ),
    }
  );
}

/**
 * Spustí 24hodinové okno, aniž by změnilo pořadí.
 * Už běžící rotaci neresetuje. Veřejné čtení galerie tuto funkci nevolá.
 */
export async function spustitRotaciProlnuti(
  oidcZHeaderu?: string | null
): Promise<"spusteno" | "uz-bezi"> {
  const stav = await nacistDataCerstve(oidcZHeaderu);
  if (jePlatnyCasRotaceProlnuti(stav.rotaceProlnutiOd)) return "uz-bezi";

  await upravitData(
    (uloziste) => {
      const vysledek = vysledekSpusteniRotace(
        uloziste.rotaceProlnutiOd,
        Date.now()
      );
      if (!vysledek.spusteno) return;
      uloziste.rotaceProlnutiOd = vysledek.rotaceOd;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        jePlatnyCasRotaceProlnuti(uloziste.rotaceProlnutiOd),
    }
  );

  return "spusteno";
}
