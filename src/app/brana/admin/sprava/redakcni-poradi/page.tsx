import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminRedakcniPoradi } from "@/components/brana/admin/BranaAdminRedakcniPoradi";
import {
  BRANA_REDAKCNI_CHYBA_CTENI,
  nacistRedakcniPoradi,
} from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → Redakční pořadí – editovatelná pracovní tabulka s trvalým uložením */
export default async function StrankaBranaAdminRedakcniPoradi() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nacist = await nacistRedakcniPoradi();

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="redakcni-poradi"
    >
      <section
        className="space-y-6"
        aria-labelledby="brana-admin-redakcni-poradi-nadpis"
      >
        <h2
          id="brana-admin-redakcni-poradi-nadpis"
          className="text-base font-normal text-text"
        >
          Redakční pořadí
        </h2>

        {nacist.ok ? (
          <BranaAdminRedakcniPoradi pocatecniPolozky={nacist.polozky} />
        ) : (
          <p className="text-sm text-text" role="alert">
            {BRANA_REDAKCNI_CHYBA_CTENI}
          </p>
        )}
      </section>
    </BranaAdminObal>
  );
}
