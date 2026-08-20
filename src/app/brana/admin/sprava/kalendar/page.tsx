import { headers } from "next/headers";
import { BranaAdminKalendarRucniZapis } from "@/components/brana/admin/BranaAdminKalendarRucniZapis";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { textStariAsistovanychZdroju } from "@/lib/brana/admin/asistovane-zdroje-stari";
import {
  dnesIsoVPraze,
  filtrujDnyPracovnihoKalendareOdDnes,
  formatujDenKalendare,
  projektujKalendarDny,
  type BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import {
  doplnPrazdneDnyDoKalendare,
  isoDenPoslednihoDneKontrolnihoBlokuVPraze,
  sestavIdProSchvalitKontrolu,
  spocitejPrazdneDnyKontrolnihoBloku,
  textUpozorneniPrazdnychDni,
} from "@/lib/brana/admin/kontrolni-blok";
import { nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { textSkupinovehoScanuProKalendar } from "@/lib/brana/admin/skupinovy-scan-stav";
import { maUkazkovyVyhledAno } from "@/lib/brana/admin/ukazkove-udalosti";
import { nacistUpozorneniNastaveni } from "@/lib/brana/admin/upozorneni-uloziste";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import "../../brana-admin-kalendar.css";

/** Správa → Kalendář – projekce konkrétních událostí do dnů (vč. vícedenních) */
export default async function StrankaBranaAdminKalendar() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const [uloziste, redakcni, upozorneni] = await Promise.all([
    nacistKonkretniUdalosti(),
    nacistRedakcniPoradi(),
    nacistUpozorneniNastaveni(),
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

  const vyhledPodleId = new Map(
    redakcni.ok
      ? redakcni.polozky.map((p) => [p.id, p.vyhled] as const)
      : [],
  );

  const vsechnyUdalosti: BranaKonkretniUdalost[] = [...rucniUdalosti];

  const dnyZUdalosti = projektujKalendarDny(vsechnyUdalosti, (id) =>
    poradiPodleId.get(id),
  );

  const idCekaKeSchvaleniKontroly = uloziste.ok
    ? sestavIdProSchvalitKontrolu(rucniUdalosti, (redakcniPolozkaId) =>
        maUkazkovyVyhledAno(
          redakcniPolozkaId,
          vyhledPodleId.get(redakcniPolozkaId),
        ),
      )
    : [];

  const { prazdneIsoDny, pocet: pocetPrazdnychDniKontrolnihoBloku } =
    uloziste.ok
      ? spocitejPrazdneDnyKontrolnihoBloku(
          rucniUdalosti,
          idCekaKeSchvaleniKontroly,
        )
      : { prazdneIsoDny: [] as string[], pocet: 0 };

  const dnesIso = dnesIsoVPraze();
  const dny = filtrujDnyPracovnihoKalendareOdDnes(
    doplnPrazdneDnyDoKalendare(
      dnyZUdalosti,
      prazdneIsoDny,
      formatujDenKalendare,
    ),
    dnesIso,
  );

  const automatickePodleDne: Record<string, BranaKonkretniUdalost[]> = {};
  for (const den of dny) {
    automatickePodleDne[den.isoDen] = den.udalosti.filter(
      (u) => u.redakcniPolozkaId !== null,
    );
  }

  const isoDenPoslednihoDneKontrolnihoBloku =
    isoDenPoslednihoDneKontrolnihoBlokuVPraze();
  const textStariAsistovanych = textStariAsistovanychZdroju();
  const rychlyScanText = textSkupinovehoScanuProKalendar(
    "Rychlý scan",
    upozorneni.ok ? upozorneni.dokument.posledniRychlySkupinovyScan : null,
    dnesIso,
  );
  const dlouhyScanText = textSkupinovehoScanuProKalendar(
    "Dlouhý scan",
    upozorneni.ok ? upozorneni.dokument.posledniDlouhySkupinovyScan : null,
    dnesIso,
  );

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
        <div className="space-y-1">
          <h2
            id="brana-admin-kalendar-nadpis"
            className="text-base font-normal text-text"
          >
            Pracovní kalendář
          </h2>
          <p className="text-xs text-text-jemny">{rychlyScanText}</p>
          <p className="text-xs text-text-jemny">{dlouhyScanText}</p>
        </div>
        <div className="space-y-1">
          {textStariAsistovanych ? (
            <p className="text-sm text-text">{textStariAsistovanych}</p>
          ) : null}
          <p className="text-sm text-text">
            Aktualizuj všechny asistované zdroje podle uloženého postupu.
          </p>
          <p className="text-xs text-text-jemny">
            Vlož do Cursoru → projekt trebon-po-cely-rok
          </p>
        </div>

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
          isoDenPoslednihoDneKontrolnihoBloku={
            isoDenPoslednihoDneKontrolnihoBloku
          }
          idCekaKeSchvaleniKontroly={idCekaKeSchvaleniKontroly}
          upozorneniPrazdnychDni={
            pocetPrazdnychDniKontrolnihoBloku > 0
              ? textUpozorneniPrazdnychDni(pocetPrazdnychDniKontrolnihoBloku)
              : null
          }
        />
      </section>
    </BranaAdminObal>
  );
}
