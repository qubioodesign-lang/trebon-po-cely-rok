import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminPlaceholder } from "@/components/brana/admin/BranaAdminPlaceholder";

/** Správa → Zdroje – připravená sekce bez dat a formulářů */
export default async function StrankaBranaAdminZdroje() {
  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="zdroje"
    >
      <BranaAdminPlaceholder
        nadpis="Zdroje"
        popis="Sekce je připravená. Seznam zdrojů se doplní později."
      />
    </BranaAdminObal>
  );
}
