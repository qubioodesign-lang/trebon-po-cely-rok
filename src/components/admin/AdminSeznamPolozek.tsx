import type { AnalyticsSouhrn, Polozka } from "@/types";

import { sestavitUrlPolozky } from "@/lib/url-polozky";

import {

  formatovatDatumPolozky,

  mapaMetrikPolozek,

  popisekTypu,

} from "./pomocne";



interface PropsAdminSeznamPolozek {

  polozky: Polozka[];

  analytics: AnalyticsSouhrn | null;

  upravovanyId: string | null;

  nahrazujeId: string | null;

  probihaNahradiFotografii: boolean;

  chybaPolozky?: string;

  maChybuNacitani: boolean;

  onUpravit: (id: string) => void;

  onPosun: (index: number, smer: "nahoru" | "dolu") => void;

  onPrepnoutAktivni: (id: string, aktivni: boolean) => void;

  onSmazat: (id: string) => void;

  onNahraditFotografii: (id: string) => void;

}



export function AdminSeznamPolozek({

  polozky,

  analytics,

  upravovanyId,

  nahrazujeId,

  probihaNahradiFotografii,

  chybaPolozky,

  maChybuNacitani,

  onUpravit,

  onPosun,

  onPrepnoutAktivni,

  onSmazat,

  onNahraditFotografii,

}: PropsAdminSeznamPolozek) {

  const metrikyPolozek = mapaMetrikPolozek(analytics);



  return (

    <section className="space-y-3">

      <h2 className="text-sm font-light text-text-jemny">

        galerie ({polozky.length})

      </h2>



      {chybaPolozky && !maChybuNacitani && (

        <p className="text-xs text-red-400">chyba načtení položek: {chybaPolozky}</p>

      )}



      {polozky.length === 0 && !maChybuNacitani && (

        <p className="text-xs text-text-velmiJemny">žádné položky v galerii</p>

      )}



      <div className="space-y-2">

        {polozky.map((polozka, index) => {

          const upravuje = upravovanyId === polozka.id;

          const metriky = metrikyPolozek.get(polozka.id);



          return (

            <div

              key={polozka.id}

              className={`rounded border p-3 ${

                upravuje

                  ? "border-text-jemny/35 bg-krem-tmavsi/20"

                  : "border-text-velmiJemny/20"

              } ${!polozka.aktivni ? "opacity-50" : ""}`}

            >

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

                <div className="flex min-w-0 flex-1 items-start gap-3">

                  <div className="flex flex-col gap-1 pt-1">

                    <button

                      type="button"

                      onClick={() => onPosun(index, "nahoru")}

                      disabled={index === 0}

                      className="text-xs text-text-velmiJemny disabled:opacity-30"

                      aria-label="Posunout nahoru"

                    >

                      ↑

                    </button>

                    <button

                      type="button"

                      onClick={() => onPosun(index, "dolu")}

                      disabled={index === polozky.length - 1}

                      className="text-xs text-text-velmiJemny disabled:opacity-30"

                      aria-label="Posunout dolů"

                    >

                      ↓

                    </button>

                  </div>



                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden bg-krem-tmavsi">

                    {polozka.typ === "prolnuti" ? (

                      <div className="relative h-full w-full">

                        {/* eslint-disable-next-line @next/next/no-img-element */}

                        <img

                          src={sestavitUrlPolozky(

                            polozka.soubory?.[0] ?? polozka.soubor ?? ""

                          )}

                          alt=""

                          className="h-full w-full object-cover"

                        />

                        <span className="absolute bottom-0 right-0 bg-krem/80 px-0.5 text-[8px] text-text-velmiJemny">

                          A→B

                        </span>

                      </div>

                    ) : polozka.typ === "fotografie" && polozka.soubor ? (

                      // eslint-disable-next-line @next/next/no-img-element

                      <img

                        src={sestavitUrlPolozky(polozka.soubor)}

                        alt=""

                        className="h-full w-full object-cover"

                      />

                    ) : (

                      <span className="flex h-full items-center justify-center text-xs text-text-velmiJemny">

                        video

                      </span>

                    )}

                  </div>



                  <div className="min-w-0 flex-1 space-y-2">

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">

                      <span className="text-text-velmiJemny">

                        {popisekTypu(polozka.typ)}

                      </span>

                      <span

                        className={

                          polozka.aktivni

                            ? "text-text-jemny"

                            : "text-text-velmiJemny"

                        }

                      >

                        {polozka.aktivni ? "viditelné" : "skryté"}

                      </span>

                      <span className="text-text-velmiJemny">

                        {formatovatDatumPolozky(polozka.datumPorizeni)}

                      </span>

                      <span className="tabular-nums text-text-velmiJemny">

                        zobr. {metriky?.zobrazeni ?? 0}

                      </span>

                      <span className="tabular-nums text-text-velmiJemny">

                        sdíl. {metriky?.sdileni ?? 0}

                      </span>

                      <span className="tabular-nums text-text-velmiJemny">

                        replay{" "}

                        {polozka.typ === "prolnuti"

                          ? (metriky?.replay ?? 0)

                          : "—"}

                      </span>

                    </div>



                    <p className="truncate text-sm text-text">

                      {polozka.popis || "—"}

                    </p>

                  </div>

                </div>



                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-text-velmiJemny/10 pt-2 lg:border-t-0 lg:pt-0">

                  <button

                    type="button"

                    onClick={() => onUpravit(polozka.id)}

                    className={`text-xs ${upravuje ? "text-text-jemny" : "text-text"}`}

                    aria-current={upravuje ? "true" : undefined}

                  >

                    upravit

                  </button>



                  {polozka.typ === "fotografie" && (

                    <button

                      type="button"

                      onClick={() => onNahraditFotografii(polozka.id)}

                      disabled={probihaNahradiFotografii}

                      className="text-xs text-text-velmiJemny disabled:opacity-30"

                    >

                      {nahrazujeId === polozka.id

                        ? "Probíhá nahrávání..."

                        : "nahradit fotografii"}

                    </button>

                  )}



                  <button

                    type="button"

                    onClick={() =>

                      onPrepnoutAktivni(polozka.id, polozka.aktivni)

                    }

                    className="text-xs text-text-velmiJemny"

                  >

                    {polozka.aktivni ? "skrýt" : "zobrazit"}

                  </button>



                  <button

                    type="button"

                    onClick={() => onSmazat(polozka.id)}

                    className="text-xs text-red-400/70"

                  >

                    smazat

                  </button>

                </div>

              </div>

            </div>

          );

        })}

      </div>

    </section>

  );

}


