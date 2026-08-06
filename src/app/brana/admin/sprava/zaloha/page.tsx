import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminPlaceholder } from "@/components/brana/admin/BranaAdminPlaceholder";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → Záloha – připravená sekce bez exportu a logiky */
export default async function StrankaBranaAdminZaloha() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="zaloha"
    >
      <BranaAdminPlaceholder
        nadpis="Záloha"
        popis="Sekce je připravená. Zálohování a obnova se doplní později."
      />
    </BranaAdminObal>
  );
}
