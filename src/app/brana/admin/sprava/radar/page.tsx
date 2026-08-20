import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminRadarPridat } from "@/components/brana/admin/BranaAdminRadarPridat";
import {
  BRANA_RADAR_CHYBA_CTENI,
  nacistRadar,
} from "@/lib/brana/admin/radar-uloziste";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → RADAR – výzkumný přehled. Nic odsud se nepublikuje. */
export default async function StrankaBranaAdminRadar() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const nacist = await nacistRadar();

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="radar"
    >
      <section
        className="space-y-6 bg-white"
        aria-labelledby="brana-admin-radar-nadpis"
      >
        <div className="space-y-2">
          <h2
            id="brana-admin-radar-nadpis"
            className="text-base font-normal text-text"
          >
            RADAR
          </h2>
          <p className="text-sm text-text-jemny">
            Výzkumný přehled. Nic odsud se automaticky nepublikuje do BRÁNY.
          </p>
        </div>

        <div role="region" aria-label="Pracovní RADAR">
          {nacist.ok ? (
            <p className="text-sm text-text-jemny">
              RADAR zatím nemá žádné pracovní stopy.
            </p>
          ) : (
            <p className="text-sm text-text" role="alert">
              {BRANA_RADAR_CHYBA_CTENI}
            </p>
          )}
        </div>

        <BranaAdminRadarPridat uloziteniPovoleno={nacist.ok} />
      </section>
    </BranaAdminObal>
  );
}
