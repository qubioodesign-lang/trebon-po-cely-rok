import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminUceniArchiv } from "@/components/brana/admin/BranaAdminUceniArchiv";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  BRANA_UCENI_CHYBA_CTENI,
  nacistUceni,
} from "@/lib/brana/admin/uceni-uloziste";

/** Správa → Učení – oddělený archiv redakčních příkladů. */
export default async function StrankaBranaAdminUceni() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nacist = await nacistUceni();

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="uceni"
    >
      <section
        className="space-y-6"
        aria-labelledby="brana-admin-uceni-nadpis"
      >
        <div className="space-y-2">
          <h2
            id="brana-admin-uceni-nadpis"
            className="text-base font-normal text-text"
          >
            Učení
          </h2>
          <p className="text-sm text-text-jemny">
            Oddělený archiv redakčních příkladů. Nemění Kalendář ani RADAR.
          </p>
        </div>

        <BranaAdminUceniArchiv
          polozky={nacist.ok ? nacist.polozky : []}
          pocet={nacist.ok ? nacist.pocet : 0}
          obdobi={nacist.ok ? nacist.obdobi : null}
          velikostBajtu={nacist.ok ? nacist.velikostBajtu : 0}
          chybaCteni={nacist.ok ? null : BRANA_UCENI_CHYBA_CTENI}
        />
      </section>
    </BranaAdminObal>
  );
}
