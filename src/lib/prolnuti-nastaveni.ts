import "server-only";

import { upravitData, nacistData } from "./uloziste-dat";
import {
  sloucitProlnutiCasovani,
  type ProlnutiCasovaniNastaveni,
  type ProlnutiCasovaniUlozene,
} from "./prolnuti-casovani";

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
        uloziste.prolnutiCasovani?.delkaProlnutiMs === nastaveni.delkaProlnutiMs,
    }
  );
}
