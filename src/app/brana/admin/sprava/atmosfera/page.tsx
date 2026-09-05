import { headers } from "next/headers";
import { BranaAdminAtmosfera } from "@/components/brana/admin/BranaAdminAtmosfera";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAtmosferaDokumentPokudExistuje } from "@/lib/brana/admin/atmosfera-uloziste";
import { maBranaAdminBlobKonfiguraci } from "@/lib/brana/admin/env-blob-brana-admin";

/** Správa → Atmosféra – ruční dočasný override veřejné věty */
export default async function StrankaBranaAdminAtmosfera() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const uloziteniPovoleno = maBranaAdminBlobKonfiguraci();

  let pocatecni = null;
  let chybaCteni: string | null = null;

  if (!uloziteniPovoleno) {
    chybaCteni = "Atmosféra úložiště není nakonfigurované.";
  } else {
    try {
      pocatecni = await nacistAtmosferaDokumentPokudExistuje();
    } catch {
      chybaCteni = "Stav Atmosféry se nepodařilo načíst.";
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
      />
    </BranaAdminObal>
  );
}
