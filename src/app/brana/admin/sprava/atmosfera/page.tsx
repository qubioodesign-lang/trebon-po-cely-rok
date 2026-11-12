import { headers } from "next/headers";
import { BranaAdminAtmosfera } from "@/components/brana/admin/BranaAdminAtmosfera";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAtmosferaDokumentPokudExistuje } from "@/lib/brana/admin/atmosfera-uloziste";
import { nactiSkrytiAkciNaVikend } from "@/lib/brana/admin/akci-na-vikend-uloziste";
import { nactiSkrytiZameckehoParku } from "@/lib/brana/admin/zamecky-park-uloziste";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
import {
  jeAkciNaVikendRucneSkryte,
  jeOknoAkciNaVikend,
} from "@/lib/brana/sdileni-akci-na-vikend";
import { jeZameckyParkRucneSkryty } from "@/lib/brana/zamecky-park";

/** Správa → Atmosféra – ruční dočasný override veřejné věty */
export default async function StrankaBranaAdminAtmosfera() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const uloziteniPovoleno = maBranaAdminBlobKonfiguraci();

  let pocatecni = null;
  let chybaCteni: string | null = null;
  let parkSkrytoDo: string | null = null;
  let parkJeSkryty = false;
  let parkChybaCteni: string | null = null;
  let vikendSkrytoDo: string | null = null;
  let vikendJeSkryty = false;
  let vikendJeVOkne = false;
  let vikendChybaCteni: string | null = null;

  if (!uloziteniPovoleno) {
    chybaCteni = "Atmosféra úložiště není nakonfigurované.";
  } else {
    try {
      pocatecni = await nacistAtmosferaDokumentPokudExistuje();
    } catch {
      chybaCteni = "Stav Atmosféry se nepodařilo načíst.";
    }
    const skryti = await nactiSkrytiZameckehoParku();
    if (skryti.stav === "chyba") {
      parkChybaCteni =
        "Stav skrytí zámeckého parku se nepodařilo načíst.";
    } else if (skryti.stav === "ok") {
      parkSkrytoDo = skryti.skrytoDo;
      parkJeSkryty = jeZameckyParkRucneSkryty(new Date(), skryti.skrytoDo);
    }

    try {
      const vikendOkamzik = new Date();
      vikendJeVOkne = jeOknoAkciNaVikend(vikendOkamzik);
      const skrytiVikend = await nactiSkrytiAkciNaVikend();
      if (skrytiVikend.stav === "chyba") {
        vikendChybaCteni =
          "Stav skrytí akcí na víkend se nepodařilo načíst.";
      } else if (skrytiVikend.stav === "ok") {
        vikendSkrytoDo = skrytiVikend.skrytoDo;
        vikendJeSkryty = jeAkciNaVikendRucneSkryte(
          vikendOkamzik,
          skrytiVikend.skrytoDo,
          skrytiVikend.oknoIso,
        );
      }
    } catch {
      vikendChybaCteni = "Stav skrytí akcí na víkend se nepodařilo načíst.";
    }
  }

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="atmosfera"
    >
      <BranaAdminAtmosfera
        pocatecni={pocatecni}
        chybaCteni={chybaCteni}
        uloziteniPovoleno={uloziteniPovoleno}
        parkSkrytoDo={parkSkrytoDo}
        parkJeSkryty={parkJeSkryty}
        parkChybaCteni={parkChybaCteni}
        vikendSkrytoDo={vikendSkrytoDo}
        vikendJeSkryty={vikendJeSkryty}
        vikendJeVOkne={vikendJeVOkne}
        vikendChybaCteni={vikendChybaCteni}
      />
    </BranaAdminObal>
  );
}
