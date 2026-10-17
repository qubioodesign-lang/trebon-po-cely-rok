import { headers } from "next/headers";
import { BranaAdminAnalytikaGrafy } from "@/components/brana/admin/BranaAdminAnalytikaGrafy";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminVylouceniZarizeni } from "@/components/brana/admin/BranaAdminVylouceniZarizeni";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistPodkladyGrafuProAdministraci } from "@/lib/brana/analytika/cteni-administrace";
import {
  BRANA_ANALYTIKA_GRAF_OBDOBI,
  type BranaAnalytikaGrafObdobi,
  type PodkladyGrafuBrany,
} from "@/lib/brana/analytika/grafy";

/** Analytika – osm grafů nad denními součty. */
export default async function StrankaBranaAdminAnalytika() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const ted = new Date();
  const vysledky = await Promise.all(
    BRANA_ANALYTIKA_GRAF_OBDOBI.map((obdobi) => nacistPodkladyGrafuProAdministraci(obdobi, ted)),
  );
  const host = (await headers()).get("host");
  const odmitnuty = vysledky.find((vysledek) => !vysledek.ok && vysledek.duvod === "neprihlasen");
  if (odmitnuty) {
    return null;
  }

  const chyba = vysledky.find((vysledek) => !vysledek.ok);
  const podklady = chyba
    ? null
    : Object.fromEntries(
        BRANA_ANALYTIKA_GRAF_OBDOBI.map((obdobi, index) => {
          const vysledek = vysledky[index];
          return [obdobi, vysledek?.ok ? bezObalky(vysledek) : null];
        }),
      );

  return (
    <BranaAdminObal host={host} aktivniCast="analytika">
      {chyba && !chyba.ok ? (
        <p className="brana-text">
          {chyba.duvod === "poskozeny-dokument"
            ? "Uložená analytika je poškozená a nebyla přepsána. Součty se nezobrazují jako nuly."
            : "Analytiku se nepodařilo načíst. Toto není nulová návštěvnost."}
        </p>
      ) : podklady && jeKompletni(podklady) ? (
        <BranaAdminAnalytikaGrafy podklady={podklady} />
      ) : null}
      <BranaAdminVylouceniZarizeni />
    </BranaAdminObal>
  );
}

function bezObalky(
  vysledek: { ok: true } & PodkladyGrafuBrany,
): PodkladyGrafuBrany {
  const { ok: _ok, ...podklady } = vysledek;
  return podklady;
}

function jeKompletni(
  podklady: Partial<Record<BranaAnalytikaGrafObdobi, PodkladyGrafuBrany | null>>,
): podklady is Record<BranaAnalytikaGrafObdobi, PodkladyGrafuBrany> {
  return BRANA_ANALYTIKA_GRAF_OBDOBI.every((obdobi) => podklady[obdobi] != null);
}
