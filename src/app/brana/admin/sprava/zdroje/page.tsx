import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminZdrojeRytmus } from "@/components/brana/admin/BranaAdminZdrojeRytmus";
import { BranaAdminZdrojeSeznam } from "@/components/brana/admin/BranaAdminZdrojeSeznam";
import {
  BRANA_ZDROJE_CHYBA_CTENI,
  nacistZdroje,
} from "@/lib/brana/admin/zdroje-uloziste";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → Zdroje – rytmus kontroly + produkční seznam známých zdrojů */
export default async function StrankaBranaAdminZdroje() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const seznam = await nacistZdroje();

  const zapisPovolen = seznam.ok;
  const zdroje = seznam.ok ? seznam.zdroje : [];

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
          zapisPovolen={zapisPovolen}
          chybaCteni={zapisPovolen ? null : BRANA_ZDROJE_CHYBA_CTENI}
        />
      </section>
    </BranaAdminObal>
  );
}
