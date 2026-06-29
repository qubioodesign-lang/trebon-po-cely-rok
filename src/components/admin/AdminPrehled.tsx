import type { AnalyticsSouhrn, MetrikySouhrn, Polozka } from "@/types";
import { sestavitUrlPolozky } from "@/lib/url-polozky";
import { ziskatHlavniSouborPolozky } from "@/lib/polozka-soubory";
import { soucetSdileni, topPolozky } from "./pomocne";

function KartaMetriky({
  popisek,
  hodnota,
  poznamka,
}: {
  popisek: string;
  hodnota: string | number;
  poznamka?: string;
}) {
  return (
    <div className="rounded border border-text-velmiJemny/20 bg-krem-tmavsi/20 px-4 py-3">
      <p className="text-[11px] font-light uppercase tracking-wide text-text-velmiJemny">
        {popisek}
      </p>
      <p className="mt-1 text-2xl font-light tabular-nums text-text">{hodnota}</p>
      {poznamka && (
        <p className="mt-1 text-[10px] text-text-velmiJemny">{poznamka}</p>
      )}
    </div>
  );
}

interface PropsAdminPrehled {
  metriky: MetrikySouhrn | null;
  analytics: AnalyticsSouhrn | null;
  polozky: Polozka[];
  chybaMetriky?: string;
}

export function AdminPrehled({
  metriky,
  analytics,
  polozky,
  chybaMetriky,
}: PropsAdminPrehled) {
  const top = topPolozky(analytics, 10);
  const celkemSdileni = soucetSdileni(analytics);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-light text-text-jemny">přehled</h2>

      {chybaMetriky && (
        <p className="text-xs text-red-400">chyba načtení metrik: {chybaMetriky}</p>
      )}

      {metriky ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KartaMetriky popisek="návštěvy" hodnota={metriky.pocetNavstev} />
          <KartaMetriky
            popisek="zobrazení"
            hodnota={metriky.pocetZobrazeniFotografii}
          />
          <KartaMetriky popisek="návraty" hodnota={metriky.pocetNavratuZpet} />
          <KartaMetriky
            popisek="chci se vracet"
            hodnota={metriky.pocetKliknutiChciSeVracet}
          />
          <KartaMetriky popisek="sdílení" hodnota={celkemSdileni} />
          <KartaMetriky
            popisek="replay"
            hodnota={metriky.pocetReplayProlnuti}
          />
        </div>
      ) : (
        <p className="text-xs text-text-velmiJemny">data metrik nejsou k dispozici</p>
      )}

      <div className="space-y-2 rounded border border-text-velmiJemny/20 p-4">
        <h3 className="text-xs font-light text-text-velmiJemny">top 10 položek</h3>
        {top.length === 0 ? (
          <p className="text-xs text-text-velmiJemny">žádné položky</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-xs text-text-velmiJemny">
              <thead>
                <tr className="border-b border-text-velmiJemny/20">
                  <th className="py-1.5 pr-3 font-light">#</th>
                  <th className="py-1.5 pr-3 font-light">položka</th>
                  <th className="py-1.5 pr-3 font-light">zobrazení</th>
                  <th className="py-1.5 font-light">sdílení</th>
                </tr>
              </thead>
              <tbody>
                {top.map((radek, index) => {
                  const polozka = polozky.find((p) => p.id === radek.polozkaId);
                  const soubor = polozka
                    ? ziskatHlavniSouborPolozky(polozka)
                    : null;

                  return (
                    <tr
                      key={radek.polozkaId}
                      className="border-b border-text-velmiJemny/10"
                    >
                      <td className="py-2 pr-3 tabular-nums">{index + 1}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          {polozka && soubor ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sestavitUrlPolozky(soubor)}
                              alt=""
                              className="h-8 w-8 flex-shrink-0 bg-krem-tmavsi object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center bg-krem-tmavsi text-[10px]">
                              —
                            </span>
                          )}
                          <span className="text-text">{radek.popis || "—"}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{radek.zobrazeni}</td>
                      <td className="py-2 tabular-nums">{radek.sdileni}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
