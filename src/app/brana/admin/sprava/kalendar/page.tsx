import { headers } from "next/headers";
import { BranaAdminAkcePolozka } from "@/components/brana/admin/BranaAdminAkcePolozka";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import {
  rozlozAkci,
  type BranaAkceVstup,
} from "@/lib/brana/admin/akce-rozlozeni";
import { jeAdminPrihlasen } from "@/lib/autentizace";

type UkazkovyDen = {
  datumLabel: string;
  polozky: BranaAkceVstup[];
  /** Orientační linka hned pod tímto dnem */
  orientacePoDni?: "zitra" | "schvaleno";
};

/** Statická ukázka rozložení – bez výpočtů a datové logiky */
const UKAZKOVE_DNY: UkazkovyDen[] = [
  {
    datumLabel: "Čtvrtek 6. 8.",
    polozky: [
      {
        mistoNeboTyp: "Kino Aurora",
        nazev: "Bobr a přátelé",
        cas: "19:30",
      },
      {
        mistoNeboTyp: "Divadlo J. K. Tyla",
        nazev: "Svědomitě nepřipravení",
        cas: "19:30",
      },
      {
        mistoNeboTyp: "Divadlo",
        nazev: "Jak se Petr Vok na Třeboň stěhovati ráčil",
        cas: "18:20",
      },
    ],
    orientacePoDni: "zitra",
  },
  {
    datumLabel: "Pátek 7. 8.",
    polozky: [],
    orientacePoDni: "schvaleno",
  },
  {
    datumLabel: "Sobota 8. 8.",
    polozky: [],
  },
];

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

/** Správa → Kalendář – svislá osa dnů s publikačními položkami */
export default async function StrankaBranaAdminKalendar() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="kalendar"
    >
      <section
        className="space-y-3 bg-white"
        aria-labelledby="brana-admin-kalendar-nadpis"
      >
        <h2
          id="brana-admin-kalendar-nadpis"
          className="text-base font-normal text-text"
        >
          Pracovní kalendář
        </h2>

        <div
          className="bg-white"
          role="region"
          aria-label="Pracovní kalendář"
        >
          {UKAZKOVE_DNY.map((den) => (
            <div key={den.datumLabel}>
              <article className="brana-admin-kalendar-den">
                <h3 className="brana-admin-kalendar-datum">{den.datumLabel}</h3>
                <div>
                  {den.polozky.length > 0 ? (
                    <ul className="brana-seznam-akci">
                      {den.polozky.map((akce) => {
                        const { typ, misto, nazev, cas } = rozlozAkci(akce);
                        return (
                          <BranaAdminAkcePolozka
                            key={`${akce.mistoNeboTyp}-${akce.nazev}-${akce.cas}`}
                            typ={typ}
                            misto={misto}
                            nazev={nazev}
                            udajVpravo={cas}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="min-h-11" aria-hidden="true" />
                  )}
                </div>
              </article>

              {den.orientacePoDni === "zitra" ? (
                <OrientacniLinka
                  popisek="ZÍTRA SE PUBLIKUJE"
                  ariaLabel="Zítra se publikuje"
                />
              ) : null}
              {den.orientacePoDni === "schvaleno" ? (
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
