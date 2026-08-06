import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminPlaceholder } from "@/components/brana/admin/BranaAdminPlaceholder";

/** Analytika – připravená prázdná sekce bez funkčnosti */
export default async function StrankaBranaAdminAnalytika() {
  const host = (await headers()).get("host");

  return (
    <BranaAdminObal host={host} aktivniCast="analytika">
      <BranaAdminPlaceholder
        nadpis="Analytika"
        popis="Sekce je připravená. Analytická data a přehledy se doplní později."
      />
    </BranaAdminObal>
  );
}
