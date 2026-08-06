import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  BRANA_REDAKCNI_KOSTRA,
  BRANA_REDAKCNI_MIMO_KOSTRA,
  type BranaRedakcniPolozka,
} from "@/lib/brana/admin/redakcni-kostra";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Jemné svislé oddělení – stejný tón jako vodorovné linky administrace */
const ODD = "border-l border-text-velmiJemny/15";

function RadekTabulky({ polozka }: { polozka: BranaRedakcniPolozka }) {
  return (
    <tr className="border-b border-text-velmiJemny/15">
      <td className="whitespace-nowrap py-2 pr-2 align-top text-sm text-text">
        {polozka.pouzivat}
      </td>
      <td className="py-2 pr-3 pl-1 align-top text-sm text-text">
        {polozka.polozka}
      </td>
      <td className={`${ODD} py-2 px-2 align-top text-sm text-text`} />
      <td className={`${ODD} py-2 px-2 align-top text-sm text-text`} />
      <td className={`${ODD} py-2 px-2 align-top text-sm text-text`} />
      <td className={`${ODD} py-2 pl-3 align-top text-sm text-text`} />
    </tr>
  );
}

function HlavickaTabulky() {
  return (
    <thead>
      <tr className="border-b border-text-velmiJemny/25">
        <th className="whitespace-nowrap py-2 pr-2 text-sm font-medium text-text">
          Používat
        </th>
        <th className="py-2 pr-3 pl-1 text-sm font-medium text-text">
          Položka
        </th>
        <th
          className={`${ODD} whitespace-nowrap py-2 px-2 text-sm font-medium text-text`}
        >
          Priorita
        </th>
        <th
          className={`${ODD} whitespace-nowrap py-2 px-2 text-sm font-medium text-text`}
        >
          Subpriorita
        </th>
        <th
          className={`${ODD} whitespace-nowrap py-2 px-2 text-sm font-medium text-text`}
        >
          Výhled
        </th>
        <th className={`${ODD} py-2 pl-3 text-sm font-medium text-text`}>
          Poznámka
        </th>
      </tr>
    </thead>
  );
}

function RedakcniTabulka({
  polozky,
}: {
  polozky: readonly BranaRedakcniPolozka[];
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        {/* Používat – co nejužší */}
        <col className="w-[4.5rem]" />
        {/* Položka – hlavní pracovní sloupec v levé polovině */}
        <col className="w-[28%]" />
        {/* Priorita / Subpriorita / Výhled – stejně úzké */}
        <col className="w-[5.5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[5.5rem]" />
        {/* Poznámka – zbývající prostor vpravo */}
        <col />
      </colgroup>
      <HlavickaTabulky />
      <tbody>
        {polozky.map((polozka) => (
          <RadekTabulky key={polozka.polozka} polozka={polozka} />
        ))}
      </tbody>
    </table>
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

        <RedakcniTabulka polozky={BRANA_REDAKCNI_KOSTRA} />

        <div className="space-y-3">
          <h3 className="text-base font-normal text-text">MIMO PRVNÍ KOSTRU</h3>
          <RedakcniTabulka polozky={BRANA_REDAKCNI_MIMO_KOSTRA} />
        </div>
      </section>
    </BranaAdminObal>
  );
}
