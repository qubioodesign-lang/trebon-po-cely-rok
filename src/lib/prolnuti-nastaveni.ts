import "server-only";

import type { UlozisteDat } from "./uloziste-dat";
import { upravitData, nacistData } from "./uloziste-dat";
import {
  sloucitProlnutiCasovani,
  type ProlnutiCasovaniNastaveni,
  type ProlnutiCasovaniUlozene,
} from "./prolnuti-casovani";

export function overitProlnutiCasovaniVUlozisti(
  uloziste: Pick<UlozisteDat, "prolnutiCasovani">,
  nastaveni: ProlnutiCasovaniNastaveni
): boolean {
  const ulozene = sloucitProlnutiCasovani(uloziste.prolnutiCasovani);
  return (
    ulozene.cekaniPredStartemMs === nastaveni.cekaniPredStartemMs &&
    ulozene.delkaProlnutiMs === nastaveni.delkaProlnutiMs &&
    ulozene.replayZpozdeniMs === nastaveni.replayZpozdeniMs &&
    ulozene.replayFadeMs === nastaveni.replayFadeMs
  );
}

export async function ziskatProlnutiCasovani(
  oidcZHeaderu?: string | null
): Promise<ProlnutiCasovaniNastaveni> {
  const uloziste = await nacistData(oidcZHeaderu);
  return sloucitProlnutiCasovani(uloziste.prolnutiCasovani);
}

export async function ulozitProlnutiCasovani(
  nastaveni: ProlnutiCasovaniNastaveni,
  oidcZHeaderu?: string | null
): Promise<void> {
  const kUlozeni: ProlnutiCasovaniUlozene = { ...nastaveni };

  await upravitData(
    (uloziste) => {
      uloziste.prolnutiCasovani = kUlozeni;
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        overitProlnutiCasovaniVUlozisti(uloziste, nastaveni),
    }
  );
}
