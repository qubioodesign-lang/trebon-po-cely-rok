import { headers } from "next/headers";
import { BranaAdminAkcePolozka } from "@/components/brana/admin/BranaAdminAkcePolozka";
import { BranaAdminKalendarRucniZapis } from "@/components/brana/admin/BranaAdminKalendarRucniZapis";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
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

function OrientacniLinka({
  popisek,
  ariaLabel,
}: {
  popisek: string;
  ariaLabel: string;
}) {
  return (
    <div
      className="brana-admin-kalendar-orientace"
      role="separator"
      aria-label={ariaLabel}
    >
      <div className="brana-admin-kalendar-orientace-linka" />
      <span className="brana-admin-kalendar-orientace-popisek">{popisek}</span>
      <div className="brana-admin-kalendar-orientace-linka" />
    </div>
  );
}

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
        ) : (
          <BranaAdminKalendarRucniZapis
            posledniScanDokoncen={posledniScanDokoncen}
            automatickePodleDne={automatickePodleDne}
          />
        )}

        <div role="region" aria-label="Pracovní kalendář">
          {dny.map((den, index) => (
            <div key={den.isoDen}>
              <article className="brana-admin-kalendar-den">
                <h3 className="brana-admin-kalendar-datum">{den.datumLabel}</h3>
                <div>
                  {den.udalosti.length > 0 ? (
                    <ul className="brana-admin-seznam-akci">
                      {den.udalosti.map((udalost) => {
                        const { typ, misto, nazev } = rozlozAkci({
                          mistoNeboTyp: udalost.mistoNeboTyp,
                          nazev: udalost.nazev,
                          cas: udalost.cas,
                        });
                        return (
                          <BranaAdminAkcePolozka
                            key={`${udalost.id}-${den.isoDen}`}
                            typ={typ}
                            misto={misto}
                            nazev={nazev}
                            udajVpravo={udalost.cas}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="min-h-11" aria-hidden="true" />
                  )}
                </div>
              </article>

              {index === 0 ? (
                <OrientacniLinka
                  popisek="ZÍTRA SE PUBLIKUJE"
                  ariaLabel="Zítra se publikuje"
                />
              ) : null}
              {index === 1 ? (
                <OrientacniLinka
                  popisek="SCHVÁLENO K PUBLIKACI"
                  ariaLabel="Schváleno k publikaci"
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </BranaAdminObal>
  );
}
