import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminPlaceholder } from "@/components/brana/admin/BranaAdminPlaceholder";

/** Správa → Kalendář – hlavní budoucí pracovní plocha (zatím bez logiky) */
export default async function StrankaBranaAdminKalendar() {
  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="kalendar"
    >
      <BranaAdminPlaceholder
        nadpis="Kalendář"
        popis="Sekce je připravená. Pracovní kalendář se doplní později."
      />
    </BranaAdminObal>
  );
}
