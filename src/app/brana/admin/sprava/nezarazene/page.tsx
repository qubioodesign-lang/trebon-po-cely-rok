import { headers } from "next/headers";
import { BranaAdminNezarazeneSeznam } from "@/components/brana/admin/BranaAdminNezarazeneSeznam";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  BRANA_NEZARAZENE_CHYBA_CTENI,
  nacistNezarazene,
} from "@/lib/brana/admin/nezarazene-uloziste";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import "../../brana-admin-kalendar.css";

/** Správa → Nezařazené – produkční inbox nespárovaných scan nálezů */
export default async function StrankaBranaAdminNezarazene() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nacist = await nacistNezarazene();

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="nezarazene"
    >
      <section
        className="brana-admin-kalendar space-y-3 bg-white"
        aria-labelledby="brana-admin-nezarazene-nadpis"
      >
        <h2
          id="brana-admin-nezarazene-nadpis"
          className="text-base font-normal text-text"
        >
          Nezařazené
        </h2>

        <div role="region" aria-label="Nezařazené">
          {nacist.ok ? (
            <BranaAdminNezarazeneSeznam pocatecniOtevrene={nacist.otevrene} />
          ) : (
            <p className="text-sm text-text" role="alert">
              {BRANA_NEZARAZENE_CHYBA_CTENI}
            </p>
          )}
        </div>
      </section>
    </BranaAdminObal>
  );
}
