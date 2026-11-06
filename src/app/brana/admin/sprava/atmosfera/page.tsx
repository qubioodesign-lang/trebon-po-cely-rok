import { headers } from "next/headers";
import { BranaAdminAtmosfera } from "@/components/brana/admin/BranaAdminAtmosfera";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAtmosferaDokumentPokudExistuje } from "@/lib/brana/admin/atmosfera-uloziste";
import { nactiSkrytiZameckehoParku } from "@/lib/brana/admin/zamecky-park-uloziste";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";
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
      />
    </BranaAdminObal>
  );
}
