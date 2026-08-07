import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminZdrojeRytmus } from "@/components/brana/admin/BranaAdminZdrojeRytmus";
import {
  BRANA_DLOUHODOBY_INTERVAL_VYCHOZI,
  popisekTypuZdroje,
} from "@/lib/brana/admin/zdroj";
import {
  BRANA_ZDROJE_NASTAVENI_CHYBA_CTENI,
  nacistZdrojeNastaveni,
} from "@/lib/brana/admin/zdroje-nastaveni-uloziste";
import { ukazkoveZdrojePodleTypu } from "@/lib/brana/admin/ukazkove-zdroje";
import { jeAdminPrihlasen } from "@/lib/autentizace";

const SKUPINY = [
  { typ: "DLOUHODOBY" as const, nadpis: "Dlouhodobé" },
  { typ: "RYCHLY" as const, nadpis: "Rychlé" },
];

/** Správa → Zdroje – ukázkové zdroje + trvalé nastavení rytmu kontroly */
export default async function StrankaBranaAdminZdroje() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nastaveni = await nacistZdrojeNastaveni();
  const uloziteniPovoleno = nastaveni.ok;
  const dlouhodobyIntervalDni = nastaveni.ok
    ? nastaveni.dlouhodobyIntervalDni
    : BRANA_DLOUHODOBY_INTERVAL_VYCHOZI;

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="zdroje"
    >
      <section
        className="space-y-6"
        aria-labelledby="brana-admin-zdroje-nadpis"
      >
        <h2
          id="brana-admin-zdroje-nadpis"
          className="text-base font-normal text-text"
        >
          Zdroje
        </h2>

        <BranaAdminZdrojeRytmus
          dlouhodobyIntervalDni={dlouhodobyIntervalDni}
          uloziteniPovoleno={uloziteniPovoleno}
          chybaCteni={
            uloziteniPovoleno ? null : BRANA_ZDROJE_NASTAVENI_CHYBA_CTENI
          }
        />

        {SKUPINY.map((skupina) => {
          const zdroje = ukazkoveZdrojePodleTypu(skupina.typ);
          return (
            <div
              key={skupina.typ}
              className="space-y-2"
              role="region"
              aria-label={skupina.nadpis}
            >
              <h3 className="text-sm font-normal text-text-jemny">
                {skupina.nadpis}
              </h3>
              <ul className="space-y-1.5">
                {zdroje.map((zdroj) => (
                  <li
                    key={zdroj.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-text"
                  >
                    <span>{zdroj.nazev}</span>
                    <span className="text-text-velmiJemny">
                      {popisekTypuZdroje(zdroj.typ)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </BranaAdminObal>
  );
}
