import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminTmpUklidGalerie105Apply } from "@/components/brana/admin/BranaAdminTmpUklidGalerie105Apply";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET,
  sestavPreviewUklidGalerie105Vystavy,
} from "@/lib/brana/admin/uklid-galerie-105-vystavy";
import {
  BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";

export const dynamic = "force-dynamic";

/**
 * DOČASNÉ admin-only preview + APPLY úklidu Galerie 105.
 * Není v navigaci. Po dokončení úklidu stránku odstranit.
 * URL: /brana/admin/sprava/tmp-uklid-galerie-105-preview
 */
export default async function StrankaTmpUklidGalerie105Preview() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  const uloziste = await nacistKonkretniUdalosti();

  if (!uloziste.ok) {
    return (
      <BranaAdminObal host={host} aktivniCast="sprava">
        <h1 className="text-lg font-medium text-text">
          Dočasné preview – Galerie 105 výstavy
        </h1>
        <p className="mt-4 text-sm text-text-jemny">
          {BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI}
        </p>
        <p className="mt-2 text-sm text-text-jemny">
          Žádný zápis neproběhl.
        </p>
      </BranaAdminObal>
    );
  }

  const preview = sestavPreviewUklidGalerie105Vystavy(uloziste.udalosti);
  const akceCeka = uloziste.udalosti.filter(
    (u) =>
      u.redakcniPolozkaId === "galerie-105" &&
      u.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
      typeof u.scanKlic === "string" &&
      u.scanKlic.trim().length > 0 &&
      u.cas.trim() !== "",
  ).length;

  return (
    <BranaAdminObal host={host} aktivniCast="sprava">
      <h1 className="text-lg font-medium text-text">
        Dočasné preview / APPLY – Galerie 105 výstavy
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-text-jemny">
        Filtr: galerie-105 + CEKA_NA_SCHVALENI + scanKlic + prázdný čas.
        Očekáváno {BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET}. Hard delete
        se neprovádí.
      </p>
      <p className="mt-2 text-sm text-text-jemny">
        Aktuální CEKA Akce Galerie 105 (s časem): {akceCeka}
      </p>

      {!preview.ok ? (
        <div className="mt-6 space-y-2 text-sm">
          <p className="font-medium text-text">
            STOP – počet neodpovídá očekávání. APPLY není k dispozici.
          </p>
          <p className="text-text-jemny">
            VYBRÁNO = {preview.skutecnyPocet} (očekáváno{" "}
            {BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET})
          </p>
          <p className="text-text-jemny">
            SPRÁVNÉ AKCE S ČASEM VE VÝBĚRU ={" "}
            {preview.spravneAkceSCasemVeVyberu}
          </p>
          <p className="text-text-jemny">Žádný zápis. 0 změn stavu.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2 text-sm">
          <p className="font-medium text-text">
            PREVIEW OK – fail-closed prošlo.
          </p>
          <p className="text-text-jemny">
            VYBRÁNO = {preview.vybrano.length}
          </p>
          <p className="text-text-jemny">
            SPRÁVNÉ AKCE S ČASEM VE VÝBĚRU ={" "}
            {preview.spravneAkceSCasemVeVyberu}
          </p>
        </div>
      )}

      {preview.vybrano.length > 0 ? (
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-text">
          {preview.vybrano.map((u) => (
            <li key={u.id} className="pl-1">
              <div className="font-medium">{u.nazev}</div>
              <div className="text-text-jemny">id={u.id}</div>
              <div className="text-text-jemny">
                {u.datumOd} → {u.datumDo} · čas=
                {u.cas === "" ? "(prázdný)" : u.cas} · {u.stavSchvaleni} ·{" "}
                {u.redakcniPolozkaId}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {preview.ok ? <BranaAdminTmpUklidGalerie105Apply /> : null}
    </BranaAdminObal>
  );
}
