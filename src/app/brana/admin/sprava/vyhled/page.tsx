import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → Výhled – prázdná pracovní plocha (stejný základní vzhled jako Kalendář) */
export default async function StrankaBranaAdminVyhled() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="vyhled"
    >
      <section
        className="space-y-3 bg-white"
        aria-labelledby="brana-admin-vyhled-nadpis"
      >
        <h2
          id="brana-admin-vyhled-nadpis"
          className="text-base font-normal text-text"
        >
          Výhled
        </h2>

        <div role="region" aria-label="Výhled" />
      </section>
    </BranaAdminObal>
  );
}
