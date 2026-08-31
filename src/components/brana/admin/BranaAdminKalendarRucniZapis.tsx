"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  oznacitPosledniScanDokoncenAkce,
  pridatRucniKonkretniUdalostAkce,
  schvalitKonkretniUdalostAkce,
  schvalitKontroluAkce,
  skrytAutomatickouKonkretniUdalostAkce,
  smazatRucniKonkretniUdalostAkce,
  upravitAutomatickouCekaUdalostAkce,
  upravitRucniKonkretniUdalostAkce,
  vyrazitAutomatickouCekaUdalostAkce,
} from "@/app/brana/admin/actions";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import {
  najitUdalostVKalendari,
  pridatPotvrzenouZmenuKalendare,
  sladitKalendarDnySProps,
  type BranaKalendarPotvrzenaZmena,
} from "@/lib/brana/admin/kalendar-dny-stav";
import {
  maRychleCekaPodlozeni,
  popisekVolbyPozice,
  type BranaKalendarDen,
  type BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";
import { jeStrukturovanyVerejnyZapis } from "@/lib/brana/admin/redakcni-override";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50";

/* Přesná lokální kopie z BranaObrazovka.tsx – pouze prezentační wrap předložek. */
const JEDNOPISMENNE_PREDLOZKY = /(\s)([ksvzou])(\s+)(?=\S)/gi;

/** Nezlomitelná mezera za jednopísmennou předložkou – pouze při vykreslení. */
function zalomPredlozky(text: string): string {
  return text.replace(JEDNOPISMENNE_PREDLOZKY, "$1$2\u00A0");
}

type VolbaPozice = {
  hodnota: number;
  popisek: string;
};

type Props = {
  posledniScanDokoncen: boolean;
  automatickePodleDne: Record<string, BranaKonkretniUdalost[]>;
  dny: BranaKalendarDen[];
  /** false při chybě čtení Blobu – formulář a akce se nezobrazí */
  rucniZapisPovolen: boolean;
  /** Id událostí skutečně persistovaných v PRIVATE Blobu */
  persistovaneIdUdalosti: readonly string[];
  /** První den kontrolního bloku (YYYY-MM-DD) = blokOdIso. */
  isoDenZacatkuKontrolnihoBloku: string;
  /** Poslední den kontrolního bloku (YYYY-MM-DD) = blokDoIso. */
  isoDenPoslednihoDneKontrolnihoBloku: string;
  /**
   * Explicitní ID pro Schválit kontrolu (pevný blok ∪ Výhled).
   * Server-rendered ze skutečných PRIVATE CEKA.
   */
  idCekaKeSchvaleniKontroly: readonly string[];
  /** Popisek tlačítka ze skutečného kontrolního bloku (OD–DO). */
  textTlacitkaSchvalitKontrolu: string;
  /** Redakční hranice před prvním dnem bloku. */
  textHraniceZacatkuKontrolnihoBloku: string;
  /** Redakční hranice za posledním dnem bloku. */
  textHraniceKonceKontrolnihoBloku: string;
  /** ISO den červené hranice SCHVÁLENO DO; null = čáru nekreslit. */
  isoDenSchvalenoDo: string | null;
  /** Text červené hranice SCHVÁLENO DO; null = čáru nekreslit. */
  textHraniceSchvalenoDo: string | null;
  /** Hotový text neblokujícího upozornění; null = žádné */
  upozorneniPrazdnychDni: string | null;
};

function sestavVolbyPozice(
  automaticke: readonly BranaKonkretniUdalost[],
): VolbaPozice[] {
  const volby: VolbaPozice[] = [{ hodnota: 0, popisek: "Na začátek" }];
  automaticke.forEach((udalost, index) => {
    volby.push({
      hodnota: index + 1,
      popisek: `Za: ${popisekVolbyPozice(udalost)}`,
    });
  });
  return volby;
}

function OrientacniLinka({
  popisek,
  ariaLabel,
  vyznam,
}: {
  popisek: string;
  ariaLabel: string;
  vyznam?: "blok" | "schvaleno-do";
}) {
  const vyznamTrida =
    vyznam === "blok"
      ? " brana-admin-kalendar-orientace-blok"
      : vyznam === "schvaleno-do"
        ? " brana-admin-kalendar-orientace-schvaleno-do"
        : "";
  return (
    <div
      className={`brana-admin-kalendar-orientace${vyznamTrida}`}
      role="separator"
      aria-label={ariaLabel}
    >
      <div className="brana-admin-kalendar-orientace-linka" />
      <span className="brana-admin-kalendar-orientace-popisek">{popisek}</span>
      <div className="brana-admin-kalendar-orientace-linka" />
    </div>
  );
}

function SeznamDnu({
  dny,
  rucniAkce,
  pending,
  isoDenZacatkuKontrolnihoBloku,
  isoDenPoslednihoDneKontrolnihoBloku,
  textHraniceZacatkuKontrolnihoBloku,
  textHraniceKonceKontrolnihoBloku,
  isoDenSchvalenoDo,
  textHraniceSchvalenoDo,
  muzeSchvalitAutomatickou,
  muzeUpravitAutomatickou,
  muzeVyrazitAutomatickou,
  muzeSkrytAutomatickou,
  onSchvalit,
  onUpravit,
  onSmazat,
  onVyrazit,
  onSkryt,
}: {
  dny: BranaKalendarDen[];
  rucniAkce: boolean;
  pending: boolean;
  isoDenZacatkuKontrolnihoBloku: string;
  isoDenPoslednihoDneKontrolnihoBloku: string;
  textHraniceZacatkuKontrolnihoBloku: string;
  textHraniceKonceKontrolnihoBloku: string;
  isoDenSchvalenoDo: string | null;
  textHraniceSchvalenoDo: string | null;
  muzeSchvalitAutomatickou: (udalost: BranaKonkretniUdalost) => boolean;
  muzeUpravitAutomatickou: (udalost: BranaKonkretniUdalost) => boolean;
  muzeVyrazitAutomatickou: (udalost: BranaKonkretniUdalost) => boolean;
  muzeSkrytAutomatickou: (udalost: BranaKonkretniUdalost) => boolean;
  onSchvalit: (udalost: BranaKonkretniUdalost) => void;
  onUpravit: (udalost: BranaKonkretniUdalost) => void;
  onSmazat: (udalost: BranaKonkretniUdalost) => void;
  onVyrazit: (udalost: BranaKonkretniUdalost) => void;
  onSkryt: (udalost: BranaKonkretniUdalost) => void;
}) {
  return (
    <div role="region" aria-label="Pracovní kalendář">
      {dny.map((den) => (
        <div key={den.isoDen}>
          {isoDenZacatkuKontrolnihoBloku &&
          den.isoDen === isoDenZacatkuKontrolnihoBloku ? (
            <OrientacniLinka
              popisek={textHraniceZacatkuKontrolnihoBloku}
              ariaLabel={textHraniceZacatkuKontrolnihoBloku}
              vyznam="blok"
            />
          ) : null}
          <article
            className={
              den.jePrazdnyKontrolniDen
                ? "brana-admin-kalendar-den brana-admin-kalendar-den-prazdny"
                : "brana-admin-kalendar-den"
            }
          >
            <h3 className="brana-admin-kalendar-datum">{den.datumLabel}</h3>
            <div>
              {den.jePrazdnyKontrolniDen ? (
                <p
                  className="brana-admin-kalendar-den-nula"
                  aria-label="Prázdný den kontrolního období: 0"
                >
                  0
                </p>
              ) : null}
              {den.udalosti.length > 0 ? (
                <ul className="brana-admin-seznam-akci">
                  {den.udalosti.map((udalost) => {
                    const { typ, misto, nazev, oddelovacPredMistem } =
                      rozlozAkci({
                      mistoNeboTyp: udalost.mistoNeboTyp,
                      nazev: udalost.nazev,
                      cas: udalost.cas,
                      ...(udalost.verejneCo !== undefined
                        ? {
                            verejneCo: udalost.verejneCo,
                            verejneRozliseni: udalost.verejneRozliseni ?? null,
                          }
                        : {}),
                    });
                    const jeRucni = udalost.redakcniPolozkaId === null;
                    const cekaNaSchvaleni =
                      udalost.stavSchvaleni === "CEKA_NA_SCHVALENI";
                    const zobrazitSchvalit =
                      muzeSchvalitAutomatickou(udalost);
                    const zobrazitAutoUpravit =
                      muzeUpravitAutomatickou(udalost);
                    const zobrazitSkryt = muzeSkrytAutomatickou(udalost);
                    const zobrazitVyrazit = muzeVyrazitAutomatickou(udalost);
                    const zobrazitAkce =
                      zobrazitSchvalit ||
                      zobrazitAutoUpravit ||
                      zobrazitSkryt ||
                      zobrazitVyrazit ||
                      (rucniAkce && jeRucni);
                    return (
                      <li
                        key={`${udalost.id}-${den.isoDen}`}
                        className={
                          jeRucni
                            ? "brana-admin-akce-rucni"
                            : cekaNaSchvaleni
                              ? maRychleCekaPodlozeni(udalost)
                                ? "brana-admin-akce-ceka-na-schvaleni brana-admin-akce-ceka-rychla"
                                : "brana-admin-akce-ceka-na-schvaleni"
                              : undefined
                        }
                      >
                        <div className="brana-admin-akce-nahled">
                          <div className="brana-admin-akce-obsah">
                            <div className="brana-admin-akce-radek">
                              <span className="brana-admin-akce-typ">
                                {typ}
                              </span>
                              {misto ? (
                                <span className="brana-admin-akce-misto">
                                  {oddelovacPredMistem}
                                  {zalomPredlozky(misto)}
                                </span>
                              ) : null}
                            </div>
                            {nazev ? (
                              <span className="brana-admin-akce-nazev">
                                {zalomPredlozky(nazev)}
                              </span>
                            ) : null}
                          </div>
                          <span className="brana-admin-akce-cas">
                            {udalost.cas}
                          </span>
                        </div>
                        {cekaNaSchvaleni || zobrazitAkce ? (
                          <div className="brana-admin-akce-chrome">
                            {cekaNaSchvaleni ? (
                              <span className="brana-admin-akce-ceka-stitok">
                                Čeká na schválení
                              </span>
                            ) : null}
                            {zobrazitAkce ? (
                              <div className="mt-0.5 flex flex-wrap gap-3">
                                {zobrazitSchvalit ? (
                                  <button
                                    type="button"
                                    onClick={() => onSchvalit(udalost)}
                                    disabled={pending}
                                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                  >
                                    Schválit
                                  </button>
                                ) : null}
                                {zobrazitAutoUpravit ? (
                                  <button
                                    type="button"
                                    onClick={() => onUpravit(udalost)}
                                    disabled={pending}
                                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                  >
                                    Upravit
                                  </button>
                                ) : null}
                                {zobrazitSkryt ? (
                                  <button
                                    type="button"
                                    onClick={() => onSkryt(udalost)}
                                    disabled={pending}
                                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                  >
                                    Skrýt
                                  </button>
                                ) : null}
                                {zobrazitVyrazit ? (
                                  <button
                                    type="button"
                                    onClick={() => onVyrazit(udalost)}
                                    disabled={pending}
                                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                  >
                                    Vyřadit
                                  </button>
                                ) : null}
                                {rucniAkce && jeRucni ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onUpravit(udalost)}
                                      disabled={pending}
                                      className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                    >
                                      Upravit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onSmazat(udalost)}
                                      disabled={pending}
                                      className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                                    >
                                      Skrýt
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : den.jePrazdnyKontrolniDen ? null : (
                <div className="min-h-11" aria-hidden="true" />
              )}
            </div>
          </article>

          {isoDenSchvalenoDo &&
          textHraniceSchvalenoDo &&
          den.isoDen === isoDenSchvalenoDo ? (
            <OrientacniLinka
              popisek={textHraniceSchvalenoDo}
              ariaLabel={textHraniceSchvalenoDo}
              vyznam="schvaleno-do"
            />
          ) : null}
          {isoDenPoslednihoDneKontrolnihoBloku &&
          den.isoDen === isoDenPoslednihoDneKontrolnihoBloku ? (
            <OrientacniLinka
              popisek={textHraniceKonceKontrolnihoBloku}
              ariaLabel={textHraniceKonceKontrolnihoBloku}
              vyznam="blok"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Výjimečný ruční zápis přímo v Kalendáři (přidat / upravit / smazat),
 * úprava / vyřazení automatické CEKA a hromadné Schválit kontrolu.
 */
export function BranaAdminKalendarRucniZapis({
  posledniScanDokoncen,
  automatickePodleDne,
  dny,
  rucniZapisPovolen,
  persistovaneIdUdalosti,
  isoDenZacatkuKontrolnihoBloku,
  isoDenPoslednihoDneKontrolnihoBloku,
  idCekaKeSchvaleniKontroly: idCekaKeSchvaleniKontrolyVstup,
  textTlacitkaSchvalitKontrolu,
  textHraniceZacatkuKontrolnihoBloku,
  textHraniceKonceKontrolnihoBloku,
  isoDenSchvalenoDo,
  textHraniceSchvalenoDo,
  upozorneniPrazdnychDni,
}: Props) {
  const router = useRouter();
  const [potvrzeneZmeny, setPotvrzeneZmeny] = useState<
    BranaKalendarPotvrzenaZmena[]
  >([]);
  const [otevreno, setOtevreno] = useState(false);
  const [editovaneId, setEditovaneId] = useState<string | null>(null);
  /** true = úprava automatické CEKA (bez místa v dni) */
  const [editaceAutomaticke, setEditaceAutomaticke] = useState(false);
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [cas, setCas] = useState("");
  const [mistoNeboTyp, setMistoNeboTyp] = useState("");
  const [verejneCo, setVerejneCo] = useState("");
  const [verejneRozliseni, setVerejneRozliseni] = useState("");
  const [editaceStrukturovana, setEditaceStrukturovana] = useState(false);
  const [nazev, setNazev] = useState("");
  const [rucniPoziceVDni, setRucniPoziceVDni] = useState(0);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPotvrzeneZmeny(
      (predchozi) => sladitKalendarDnySProps(dny, predchozi).potvrzene,
    );
  }, [dny]);

  const dnyStav = useMemo(
    () => sladitKalendarDnySProps(dny, potvrzeneZmeny).dny,
    [dny, potvrzeneZmeny],
  );

  const persistovaneId = useMemo(
    () => new Set(persistovaneIdUdalosti),
    [persistovaneIdUdalosti],
  );

  /**
   * Scoped server seznam ∩ stále CEKA v aktuálním kalendářním stavu
   * (po optimistic update / refresh).
   */
  const idCekaKeSchvaleniKontroly = useMemo(() => {
    const staleCeka = new Set<string>();
    for (const den of dnyStav) {
      for (const udalost of den.udalosti) {
        if (
          persistovaneId.has(udalost.id) &&
          udalost.redakcniPolozkaId !== null &&
          udalost.stavSchvaleni === "CEKA_NA_SCHVALENI"
        ) {
          staleCeka.add(udalost.id);
        }
      }
    }
    return idCekaKeSchvaleniKontrolyVstup.filter((id) => staleCeka.has(id));
  }, [dnyStav, persistovaneId, idCekaKeSchvaleniKontrolyVstup]);

  const volbyPozice = useMemo(() => {
    const den = datumOd.trim();
    const automaticke = den ? (automatickePodleDne[den] ?? []) : [];
    return sestavVolbyPozice(automaticke);
  }, [automatickePodleDne, datumOd]);

  function potvrditZmenyKalendare(
    ...zmeny: BranaKalendarPotvrzenaZmena[]
  ) {
    setPotvrzeneZmeny((predchozi) =>
      zmeny.reduce(pridatPotvrzenouZmenuKalendare, predchozi),
    );
  }

  const muzeEditovat =
    rucniZapisPovolen && posledniScanDokoncen;

  /** Formulář otevřený (ruční přidání/úprava nebo auto úprava). */
  const formularOtevren =
    otevreno && (muzeEditovat || (editaceAutomaticke && rucniZapisPovolen));

  function maStabilniScanKlic(udalost: BranaKonkretniUdalost): boolean {
    return (
      typeof udalost.scanKlic === "string" && udalost.scanKlic.trim().length > 0
    );
  }

  function muzeUpravitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
    return (
      rucniZapisPovolen &&
      udalost.redakcniPolozkaId !== null &&
      (udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
        udalost.stavSchvaleni === "SCHVALENO") &&
      maStabilniScanKlic(udalost) &&
      persistovaneId.has(udalost.id)
    );
  }

  function muzeVyrazitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
    return (
      rucniZapisPovolen &&
      udalost.redakcniPolozkaId !== null &&
      (udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" ||
        udalost.stavSchvaleni === "SCHVALENO") &&
      persistovaneId.has(udalost.id)
    );
  }

  function muzeSkrytAutomatickou(udalost: BranaKonkretniUdalost): boolean {
    return muzeVyrazitAutomatickou(udalost);
  }

  /** Jednotlivé Schválit: automatická persistovaná CEKA (bez ohledu na typ zdroje). */
  function muzeSchvalitAutomatickou(udalost: BranaKonkretniUdalost): boolean {
    return (
      rucniZapisPovolen &&
      udalost.redakcniPolozkaId !== null &&
      udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
      persistovaneId.has(udalost.id)
    );
  }

  function resetovatFormular() {
    setEditovaneId(null);
    setEditaceAutomaticke(false);
    setDatumOd("");
    setDatumDo("");
    setCas("");
    setMistoNeboTyp("");
    setVerejneCo("");
    setVerejneRozliseni("");
    setEditaceStrukturovana(false);
    setNazev("");
    setRucniPoziceVDni(0);
  }

  function zavrit() {
    setOtevreno(false);
    resetovatFormular();
    setChyba(null);
  }

  function otevritPridani() {
    setChyba(null);
    setZprava(null);
    resetovatFormular();
    setOtevreno(true);
  }

  function otevritUpravu(udalost: BranaKonkretniUdalost) {
    const jeRucni = udalost.redakcniPolozkaId === null;
    if (jeRucni) {
      if (!muzeEditovat) {
        return;
      }
    } else if (!muzeUpravitAutomatickou(udalost)) {
      return;
    }
    setChyba(null);
    setZprava(null);
    setEditovaneId(udalost.id);
    setEditaceAutomaticke(!jeRucni);
    setDatumOd(udalost.datumOd);
    setDatumDo(udalost.datumDo);
    setCas(udalost.cas);
    setMistoNeboTyp(udalost.mistoNeboTyp);
    const strukturovana = !jeRucni && jeStrukturovanyVerejnyZapis(udalost);
    setEditaceStrukturovana(strukturovana);
    setVerejneCo(strukturovana ? (udalost.verejneCo ?? "") : "");
    setVerejneRozliseni(strukturovana ? (udalost.verejneRozliseni ?? "") : "");
    setNazev(udalost.nazev);
    // 0 = Na začátek – nesmí se ztratit přes truthy kontrolu
    setRucniPoziceVDni(
      udalost.rucniPoziceVDni === null || udalost.rucniPoziceVDni === undefined
        ? 0
        : udalost.rucniPoziceVDni,
    );
    setOtevreno(true);
  }

  function ulozit() {
    setChyba(null);
    setZprava(null);
    if (editaceAutomaticke && editovaneId) {
      const vstup = editaceStrukturovana
        ? {
            datumOd,
            datumDo: datumDo || datumOd,
            cas,
            nazev,
            verejneCo: verejneCo.trim() || null,
            verejneRozliseni: verejneRozliseni.trim() || null,
          }
        : {
            datumOd,
            datumDo: datumDo || datumOd,
            cas,
            mistoNeboTyp,
            nazev,
          };
      startTransition(async () => {
        const vysledek = await upravitAutomatickouCekaUdalostAkce(
          editovaneId,
          vstup,
        );
        if (!vysledek.uspech) {
          setChyba(vysledek.chyba);
          return;
        }
        potvrditZmenyKalendare({ typ: "upsert", udalost: vysledek.udalost });
        setZprava("Událost upravena");
        zavrit();
        router.refresh();
      });
      return;
    }
    const vstup = {
      datumOd,
      datumDo: datumDo || datumOd,
      cas,
      mistoNeboTyp,
      nazev,
      rucniPoziceVDni,
    };
    startTransition(async () => {
      const vysledek = editovaneId
        ? await upravitRucniKonkretniUdalostAkce(editovaneId, vstup)
        : await pridatRucniKonkretniUdalostAkce(vstup);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare({ typ: "upsert", udalost: vysledek.udalost });
      setZprava(editovaneId ? "Událost upravena" : "Událost uložena");
      zavrit();
      router.refresh();
    });
  }

  function smazat(udalost: BranaKonkretniUdalost) {
    if (udalost.redakcniPolozkaId !== null) {
      return;
    }
    const potvrzeno = window.confirm("Skrýt tuto událost?");
    if (!potvrzeno) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await smazatRucniKonkretniUdalostAkce(udalost.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare({ typ: "odstranit", id: udalost.id });
      if (editovaneId === udalost.id) {
        zavrit();
      }
      setZprava("Událost smazána");
      router.refresh();
    });
  }

  function schvalitKontrolu() {
    if (!rucniZapisPovolen || idCekaKeSchvaleniKontroly.length === 0) {
      return;
    }
    if (upozorneniPrazdnychDni) {
      const potvrzeno = window.confirm(
        `${upozorneniPrazdnychDni}\n\nChcete přesto kontrolu schválit?`,
      );
      if (!potvrzeno) {
        return;
      }
    }
    setChyba(null);
    setZprava(null);
    const davkaId = idCekaKeSchvaleniKontroly;
    const davkaUpsert: BranaKalendarPotvrzenaZmena[] = davkaId.flatMap((id) => {
      const karta = najitUdalostVKalendari(dnyStav, id);
      if (!karta) {
        return [];
      }
      return [
        {
          typ: "upsert" as const,
          udalost: { ...karta, stavSchvaleni: "SCHVALENO" as const },
        },
      ];
    });
    startTransition(async () => {
      const vysledek = await schvalitKontroluAkce(davkaId);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare(...davkaUpsert);
      setZprava(
        vysledek.pocetSchvalenych === 1
          ? "Kontrola schválena (1 událost)"
          : `Kontrola schválena (${vysledek.pocetSchvalenych} událostí)`,
      );
      router.refresh();
    });
  }

  function schvalitJednu(udalost: BranaKonkretniUdalost) {
    if (!muzeSchvalitAutomatickou(udalost)) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await schvalitKonkretniUdalostAkce(udalost.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare({ typ: "upsert", udalost: vysledek.udalost });
      if (editovaneId === udalost.id) {
        zavrit();
      }
      setZprava("Událost schválena");
      router.refresh();
    });
  }

  function vyrazit(udalost: BranaKonkretniUdalost) {
    if (!muzeVyrazitAutomatickou(udalost)) {
      return;
    }
    const potvrzeno = window.confirm(
      "Vyřadit tuto událost? Další scan ji znovu nenabídne.",
    );
    if (!potvrzeno) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await vyrazitAutomatickouCekaUdalostAkce(udalost.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare({ typ: "odstranit", id: vysledek.udalost.id });
      if (editovaneId === udalost.id) {
        zavrit();
      }
      setZprava("Událost vyřazena");
      router.refresh();
    });
  }

  function skryt(udalost: BranaKonkretniUdalost) {
    if (!muzeSkrytAutomatickou(udalost)) {
      return;
    }
    const potvrzeno = window.confirm(
      "Skrýt tuto událost? Při dalším scanu se může objevit znovu.",
    );
    if (!potvrzeno) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await skrytAutomatickouKonkretniUdalostAkce(udalost.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      potvrditZmenyKalendare({ typ: "odstranit", id: vysledek.udalost.id });
      if (editovaneId === udalost.id) {
        zavrit();
      }
      setZprava("Událost skryta");
      router.refresh();
    });
  }

  function oznacitScan() {
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await oznacitPosledniScanDokoncenAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava("Poslední scan označen jako dokončený");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {rucniZapisPovolen && !posledniScanDokoncen ? (
        <div className="space-y-2">
          <p className="text-sm text-text-jemny">
            Ruční zápis je dostupný až po dokončení posledního scanu.
          </p>
          <button
            type="button"
            onClick={oznacitScan}
            disabled={pending}
            className="text-sm font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
          >
            {pending ? "Ukládám…" : "Označit poslední scan jako dokončený"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {muzeEditovat && !otevreno ? (
          <button
            type="button"
            onClick={otevritPridani}
            className="text-sm font-light text-text-jemny underline-offset-2 hover:underline"
          >
            Přidat událost
          </button>
        ) : null}

        {rucniZapisPovolen && upozorneniPrazdnychDni ? (
          <p className="text-sm text-text" role="status">
            {upozorneniPrazdnychDni}
          </p>
        ) : null}

        {rucniZapisPovolen && idCekaKeSchvaleniKontroly.length > 0 ? (
          <button
            type="button"
            onClick={schvalitKontrolu}
            disabled={pending}
            className="text-sm font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
          >
            {pending ? "Ukládám…" : textTlacitkaSchvalitKontrolu}
          </button>
        ) : null}
      </div>

      {formularOtevren ? (
        <div className="space-y-3 border-b border-text-velmiJemny/15 pb-4">
          <p className="text-sm font-normal text-text">
            {editovaneId ? "Upravit událost" : "Přidat událost"}
          </p>
          <div className="grid max-w-xl gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Datum OD</span>
              <input
                type="date"
                className={VSTUP}
                value={datumOd}
                onChange={(e) => {
                  const v = e.target.value;
                  setDatumOd(v);
                  if (!datumDo || datumDo < v) {
                    setDatumDo(v);
                  }
                  if (!editaceAutomaticke) {
                    setRucniPoziceVDni(0);
                  }
                }}
              />
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Datum DO</span>
              <input
                type="date"
                className={VSTUP}
                value={datumDo}
                onChange={(e) => setDatumDo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Čas</span>
              <input
                type="time"
                className={VSTUP}
                value={cas}
                onChange={(e) => setCas(e.target.value)}
              />
            </label>
            {!editaceAutomaticke ? (
              <label className="space-y-1 text-sm text-text sm:col-span-2">
                <span className="text-text-jemny">Místo v dni</span>
                <select
                  className={VSTUP}
                  value={String(rucniPoziceVDni)}
                  onChange={(e) => {
                    const cislo = Number(e.target.value);
                    if (Number.isInteger(cislo) && cislo >= 0) {
                      setRucniPoziceVDni(cislo);
                    }
                  }}
                >
                  {volbyPozice.map((volba) => (
                    <option
                      key={`${volba.hodnota}-${volba.popisek}`}
                      value={String(volba.hodnota)}
                    >
                      {volba.popisek}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {editaceAutomaticke && editaceStrukturovana ? (
              <>
                <label className="space-y-1 text-sm text-text sm:col-span-2">
                  <span className="text-text-jemny">CO</span>
                  <input
                    type="text"
                    className={VSTUP}
                    value={verejneCo}
                    maxLength={100}
                    onChange={(e) => setVerejneCo(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm text-text sm:col-span-2">
                  <span className="text-text-jemny">KDE</span>
                  <input
                    type="text"
                    className={VSTUP}
                    value={verejneRozliseni}
                    maxLength={100}
                    onChange={(e) => setVerejneRozliseni(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <label className="space-y-1 text-sm text-text sm:col-span-2">
                <span className="text-text-jemny">CO / místo nebo typ</span>
                <input
                  type="text"
                  className={VSTUP}
                  value={mistoNeboTyp}
                  maxLength={100}
                  onChange={(e) => setMistoNeboTyp(e.target.value)}
                />
              </label>
            )}
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">Název</span>
              <input
                type="text"
                className={VSTUP}
                value={nazev}
                maxLength={200}
                onChange={(e) => setNazev(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={ulozit}
              disabled={pending}
              className="border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
            >
              {pending ? "Ukládám…" : "Uložit"}
            </button>
            <button
              type="button"
              onClick={zavrit}
              disabled={pending}
              className="text-sm font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : null}

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      {zprava ? (
        <p className="text-sm text-text-jemny" role="status">
          {zprava}
        </p>
      ) : null}

      <SeznamDnu
        dny={dnyStav}
        rucniAkce={muzeEditovat}
        pending={pending}
        isoDenZacatkuKontrolnihoBloku={isoDenZacatkuKontrolnihoBloku}
        isoDenPoslednihoDneKontrolnihoBloku={
          isoDenPoslednihoDneKontrolnihoBloku
        }
        textHraniceZacatkuKontrolnihoBloku={textHraniceZacatkuKontrolnihoBloku}
        textHraniceKonceKontrolnihoBloku={textHraniceKonceKontrolnihoBloku}
        isoDenSchvalenoDo={isoDenSchvalenoDo}
        textHraniceSchvalenoDo={textHraniceSchvalenoDo}
        muzeSchvalitAutomatickou={muzeSchvalitAutomatickou}
        muzeUpravitAutomatickou={muzeUpravitAutomatickou}
        muzeVyrazitAutomatickou={muzeVyrazitAutomatickou}
        muzeSkrytAutomatickou={muzeSkrytAutomatickou}
        onSchvalit={schvalitJednu}
        onUpravit={otevritUpravu}
        onSmazat={smazat}
        onVyrazit={vyrazit}
        onSkryt={skryt}
      />
    </div>
  );
}
