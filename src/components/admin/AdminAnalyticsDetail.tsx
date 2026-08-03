import type { AnalyticsSouhrn } from "@/types";
import { POPISY_ZDROJU, ZDROJE_NAVSTEV } from "@/lib/zdroj-navstev";
import { POPISY_ZARIZENI, ZARIZENI_NAVSTEV } from "@/lib/zarizeni-navstevnika";

interface PropsAdminAnalyticsDetail {
  analytics: AnalyticsSouhrn | null;
  pocetKliknutiPridatNaPlochu: number;
  pocetNavstevZePlochy: number;
}

export function AdminAnalyticsDetail({
  analytics,
  pocetKliknutiPridatNaPlochu,
  pocetNavstevZePlochy,
}: PropsAdminAnalyticsDetail) {
  if (!analytics) {
    return (
      <section className="space-y-3 border border-text-velmiJemny/20 p-4">
        <h2 className="text-sm font-light text-text-jemny">analytics</h2>
        <p className="text-xs text-text-velmiJemny">
          data analytics nejsou k dispozici
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border border-text-velmiJemny/20 p-4">
      <h2 className="text-sm font-light text-text-jemny">analytics</h2>

      <div className="grid gap-2 text-xs text-text-velmiJemny sm:grid-cols-2">
        <span>
          Kliknutí na Přidat Třeboň na plochu: {pocetKliknutiPridatNaPlochu}
        </span>
        <span>Návštěvy z ikony na ploše: {pocetNavstevZePlochy}</span>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-light text-text-velmiJemny">zdroje návštěv</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-velmiJemny">
            <thead>
              <tr className="border-b border-text-velmiJemny/20">
                <th className="py-1 pr-3 font-light">zdroj</th>
                <th className="py-1 font-light">návštěvy</th>
              </tr>
            </thead>
            <tbody>
              {ZDROJE_NAVSTEV.map((zdroj) => (
                <tr key={zdroj} className="border-b border-text-velmiJemny/10">
                  <td className="py-1.5 pr-3 text-text">
                    {POPISY_ZDROJU[zdroj]}
                  </td>
                  <td className="py-1.5">{analytics.zdroje[zdroj] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-light text-text-velmiJemny">
          zařízení návštěvníků
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-velmiJemny">
            <thead>
              <tr className="border-b border-text-velmiJemny/20">
                <th className="py-1 pr-3 font-light">zařízení</th>
                <th className="py-1 font-light">návštěvy</th>
              </tr>
            </thead>
            <tbody>
              {ZARIZENI_NAVSTEV.map((zarizeni) => (
                <tr
                  key={zarizeni}
                  className="border-b border-text-velmiJemny/10"
                >
                  <td className="py-1.5 pr-3 text-text">
                    {POPISY_ZARIZENI[zarizeni]}
                  </td>
                  <td className="py-1.5">
                    {analytics.navstevyPodleZarizeni[zarizeni] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
