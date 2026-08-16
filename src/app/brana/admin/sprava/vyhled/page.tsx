import { headers } from "next/headers";
import { BranaAdminAkcePolozka } from "@/components/brana/admin/BranaAdminAkcePolozka";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import {
  formatujDatumVyhled,
  projektujAdminVyhledSouhrnyPodleRoku,
} from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { maUkazkovyVyhledAno } from "@/lib/brana/admin/ukazkove-udalosti";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import "../../brana-admin-kalendar.css";

/** Správa → Výhled – souhrnná projekce stejných konkrétních událostí (PRIVATE Blob) */
export default async function StrankaBranaAdminVyhled() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const [uloziste, redakcni] = await Promise.all([
    nacistKonkretniUdalosti(),
    nacistRedakcniPoradi(),
  ]);

  const vyhledPodleId = new Map(
    redakcni.ok
      ? redakcni.polozky.map((p) => [p.id, p.vyhled] as const)
      : [],
  );
  const vyhledSeriePodleId = new Map(
    redakcni.ok
      ? redakcni.polozky.map((p) => [p.id, p.vyhledSerie] as const)
      : [],
  );

  const realneUdalosti = uloziste.ok ? uloziste.udalosti : [];

  const skupiny = projektujAdminVyhledSouhrnyPodleRoku(
    realneUdalosti,
    (redakcniPolozkaId) =>
      maUkazkovyVyhledAno(redakcniPolozkaId, vyhledPodleId.get(redakcniPolozkaId)),
    (redakcniPolozkaId) =>
      vyhledSeriePodleId.get(redakcniPolozkaId) !== false,
  );

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="vyhled"
    >
      <section
        className="brana-admin-kalendar space-y-3 bg-white"
        aria-labelledby="brana-admin-vyhled-nadpis"
      >
        <h2
          id="brana-admin-vyhled-nadpis"
          className="text-base font-normal text-text"
        >
          Výhled
        </h2>

        {!uloziste.ok ? (
          <p className="text-sm text-text" role="alert">
            {BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI}
          </p>
        ) : null}

        <div role="region" aria-label="Výhled">
          {skupiny.length === 0 ? (
            <div className="min-h-11" aria-hidden="true" />
          ) : (
            skupiny.map((skupina) => (
              <div key={skupina.rok} className="space-y-3">
                <h3 className="brana-admin-kalendar-datum">{skupina.rok}</h3>
                <ul className="brana-admin-seznam-akci">
                  {skupina.souhrny.map((souhrn) => {
                    const { typ, misto, nazev, oddelovacPredMistem } =
                      rozlozAkci({
                      mistoNeboTyp: souhrn.mistoNeboTyp,
                      nazev: souhrn.nazev,
                      cas: "",
                      ...(souhrn.verejneCo !== undefined
                        ? {
                            verejneCo: souhrn.verejneCo,
                            verejneRozliseni: souhrn.verejneRozliseni ?? null,
                          }
                        : {}),
                    });
                    return (
                      <BranaAdminAkcePolozka
                        key={souhrn.klic}
                        typ={typ}
                        misto={misto}
                        nazev={nazev}
                        oddelovacPredMistem={oddelovacPredMistem}
                        udajVpravo={formatujDatumVyhled({
                          datumOd: souhrn.datumOd,
                          datumDo: souhrn.datumDo,
                        })}
                      />
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </BranaAdminObal>
  );
}
