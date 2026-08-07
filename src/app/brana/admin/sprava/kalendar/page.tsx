import { headers } from "next/headers";
import { BranaAdminKalendarRucniZapis } from "@/components/brana/admin/BranaAdminKalendarRucniZapis";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  projektujKalendarDny,
  type BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { UKAZKOVE_KONKRETNI_UDALOSTI } from "@/lib/brana/admin/ukazkove-udalosti";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import "../../brana-admin-kalendar.css";

/** Správa → Kalendář – projekce konkrétních událostí do dnů (vč. vícedenních) */
export default async function StrankaBranaAdminKalendar() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const [uloziste, redakcni] = await Promise.all([
    nacistKonkretniUdalosti(),
    nacistRedakcniPoradi(),
  ]);

  const rucniUdalosti = uloziste.ok ? uloziste.udalosti : [];
  const posledniScanDokoncen = uloziste.ok
    ? uloziste.posledniScanDokoncen
    : false;

  const poradiPodleId = new Map(
    redakcni.ok
      ? redakcni.polozky.map(
          (p) =>
            [
              p.id,
              { priorita: p.priorita, subpriorita: p.subpriorita },
            ] as const,
        )
      : [],
  );

  const vsechnyUdalosti: BranaKonkretniUdalost[] = [
    ...UKAZKOVE_KONKRETNI_UDALOSTI,
    ...rucniUdalosti,
  ];

  const dny = projektujKalendarDny(vsechnyUdalosti, (id) =>
    poradiPodleId.get(id),
  );

  const automatickePodleDne: Record<string, BranaKonkretniUdalost[]> = {};
  for (const den of dny) {
    automatickePodleDne[den.isoDen] = den.udalosti.filter(
      (u) => u.redakcniPolozkaId !== null,
    );
  }

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="kalendar"
    >
      <section
        className="brana-admin-kalendar space-y-3"
        aria-labelledby="brana-admin-kalendar-nadpis"
      >
        <h2
          id="brana-admin-kalendar-nadpis"
          className="text-base font-normal text-text"
        >
          Pracovní kalendář
        </h2>

        {!uloziste.ok ? (
          <p className="text-sm text-text" role="alert">
            {BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI}
          </p>
        ) : null}

        <BranaAdminKalendarRucniZapis
          posledniScanDokoncen={uloziste.ok ? posledniScanDokoncen : false}
          automatickePodleDne={automatickePodleDne}
          dny={dny}
          rucniZapisPovolen={uloziste.ok}
          persistovaneIdUdalosti={rucniUdalosti.map((u) => u.id)}
        />
      </section>
    </BranaAdminObal>
  );
}
