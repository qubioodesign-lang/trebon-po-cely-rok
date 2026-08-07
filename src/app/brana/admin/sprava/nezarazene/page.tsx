import { headers } from "next/headers";
import { BranaAdminAkcePolozka } from "@/components/brana/admin/BranaAdminAkcePolozka";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import { UKAZKOVE_NEZARAZENE_AKCE } from "@/lib/brana/admin/ukazkove-nezarazene";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import "../../brana-admin-kalendar.css";

/** Správa → Nezařazené – informační seznam ukázkových nezařazených akcí */
export default async function StrankaBranaAdminNezarazene() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

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
          <ul className="brana-admin-seznam-akci">
            {UKAZKOVE_NEZARAZENE_AKCE.map((akce) => {
              const { typ, misto, nazev } = rozlozAkci({
                mistoNeboTyp: akce.mistoNeboTyp,
                nazev: akce.nazev,
                cas: akce.udajVpravo,
              });
              return (
                <BranaAdminAkcePolozka
                  key={akce.id}
                  typ={typ}
                  misto={misto}
                  nazev={nazev}
                  udajVpravo={akce.udajVpravo}
                />
              );
            })}
          </ul>
        </div>
      </section>
    </BranaAdminObal>
  );
}
