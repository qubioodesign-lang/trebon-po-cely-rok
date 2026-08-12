import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  BranaAdminZdrojeSeznam,
  type BranaZdrojKotvaVolba,
} from "@/components/brana/admin/BranaAdminZdrojeSeznam";
import { BranaAdminZdrojeRytmus } from "@/components/brana/admin/BranaAdminZdrojeRytmus";
import {
  BRANA_ZDROJE_CHYBA_CTENI,
  nacistZdroje,
} from "@/lib/brana/admin/zdroje-uloziste";
import { nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import type { BranaRedakcniJazykVerejny } from "@/lib/brana/admin/redakcni-kostra";
import { jeAdminPrihlasen } from "@/lib/autentizace";

function rozliseniProUi(
  jazykVerejny: BranaRedakcniJazykVerejny | null,
): string | null {
  if (!jazykVerejny || jazykVerejny.rozliseni.rezim !== "PEVNE") {
    return null;
  }
  const text = jazykVerejny.rozliseni.text.trim();
  return text.length > 0 ? text : null;
}

/** Správa → Zdroje – rytmus kontroly + produkční seznam známých zdrojů */
export default async function StrankaBranaAdminZdroje() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const seznam = await nacistZdroje();
  const redakcni = await nacistRedakcniPoradi();

  const zapisPovolen = seznam.ok;
  const zdroje = seznam.ok ? seznam.zdroje : [];

  const kotvyVolby: BranaZdrojKotvaVolba[] = redakcni.ok
    ? redakcni.polozky
        .filter((p) => p.pouzivat === "ANO")
        .map((p) => ({
          id: p.id,
          polozka: p.polozka,
          rozliseni: rozliseniProUi(p.jazykVerejny),
        }))
        .sort((a, b) => a.polozka.localeCompare(b.polozka, "cs"))
    : [];

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

        <BranaAdminZdrojeRytmus />

        <BranaAdminZdrojeSeznam
          zdroje={zdroje}
          kotvyVolby={kotvyVolby}
          zapisPovolen={zapisPovolen}
          chybaCteni={zapisPovolen ? null : BRANA_ZDROJE_CHYBA_CTENI}
        />
      </section>
    </BranaAdminObal>
  );
}
