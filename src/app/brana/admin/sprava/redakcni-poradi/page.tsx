import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  BRANA_REDAKCNI_KOSTRA,
  BRANA_REDAKCNI_MIMO_KOSTRA,
  type BranaRedakcniPolozka,
} from "@/lib/brana/admin/redakcni-kostra";
import { jeAdminPrihlasen } from "@/lib/autentizace";

function RadekTabulky({ polozka }: { polozka: BranaRedakcniPolozka }) {
  return (
    <tr className="border-b border-text-velmiJemny/15">
      <td className="py-2 pr-3 align-top text-sm text-text">{polozka.pouzivat}</td>
      <td className="py-2 pr-3 align-top text-sm text-text">{polozka.polozka}</td>
      <td className="py-2 pr-3 align-top text-sm text-text" />
      <td className="py-2 pr-3 align-top text-sm text-text" />
      <td className="py-2 pr-3 align-top text-sm text-text" />
      <td className="py-2 align-top text-sm text-text" />
    </tr>
  );
}

/** Správa → Redakční pořadí – statická pracovní tabulka kostry v1 */
export default async function StrankaBranaAdminRedakcniPoradi() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-text-velmiJemny/25">
                <th className="py-2 pr-3 text-sm font-medium text-text">
                  Používat
                </th>
                <th className="py-2 pr-3 text-sm font-medium text-text">
                  Položka
                </th>
                <th className="py-2 pr-3 text-sm font-medium text-text">
                  Priorita
                </th>
                <th className="py-2 pr-3 text-sm font-medium text-text">
                  Subpriorita
                </th>
                <th className="py-2 pr-3 text-sm font-medium text-text">
                  Výhled
                </th>
                <th className="py-2 text-sm font-medium text-text">Poznámka</th>
              </tr>
            </thead>
            <tbody>
              {BRANA_REDAKCNI_KOSTRA.map((polozka) => (
                <RadekTabulky key={polozka.polozka} polozka={polozka} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-normal text-text">MIMO PRVNÍ KOSTRU</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-text-velmiJemny/25">
                  <th className="py-2 pr-3 text-sm font-medium text-text">
                    Používat
                  </th>
                  <th className="py-2 pr-3 text-sm font-medium text-text">
                    Položka
                  </th>
                  <th className="py-2 pr-3 text-sm font-medium text-text">
                    Priorita
                  </th>
                  <th className="py-2 pr-3 text-sm font-medium text-text">
                    Subpriorita
                  </th>
                  <th className="py-2 pr-3 text-sm font-medium text-text">
                    Výhled
                  </th>
                  <th className="py-2 text-sm font-medium text-text">
                    Poznámka
                  </th>
                </tr>
              </thead>
              <tbody>
                {BRANA_REDAKCNI_MIMO_KOSTRA.map((polozka) => (
                  <RadekTabulky key={polozka.polozka} polozka={polozka} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </BranaAdminObal>
  );
}
