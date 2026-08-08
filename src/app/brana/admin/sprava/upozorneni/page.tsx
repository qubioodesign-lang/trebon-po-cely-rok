import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminUpozorneniFormulare } from "@/components/brana/admin/BranaAdminUpozorneniFormulare";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  BRANA_UPOZORNENI_CHYBA_CTENI,
  dokumentNaUi,
  nacistUpozorneniNastaveni,
  vychoziUpozorneniNastaveni,
} from "@/lib/brana/admin/upozorneni-uloziste";

/** Správa → Upozornění – PRIVATE Web Push subscription + kotva dlouhodobé kontroly */
export default async function StrankaBranaAdminUpozorneni() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nacist = await nacistUpozorneniNastaveni();
  const uloziteniPovoleno = nacist.ok;
  const dokument = nacist.ok ? nacist.dokument : vychoziUpozorneniNastaveni();

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="upozorneni"
    >
      <section
        className="space-y-6"
        aria-labelledby="brana-admin-upozorneni-nadpis"
      >
        <h2
          id="brana-admin-upozorneni-nadpis"
          className="text-base font-normal text-text"
        >
          Upozornění
        </h2>

        <BranaAdminUpozorneniFormulare
          pocatecni={dokumentNaUi(dokument)}
          uloziteniPovoleno={uloziteniPovoleno}
          chybaCteni={uloziteniPovoleno ? null : BRANA_UPOZORNENI_CHYBA_CTENI}
        />
      </section>
    </BranaAdminObal>
  );
}
