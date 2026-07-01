"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AdminChyby, AdminData, Polozka } from "@/types";
import {
  prihlasitAdmin,
  odhlasitAdmin,
  nahratPolozku,
  nahratSouborGalerie,
  vytvoritProlnutiAdmin,
  smazatNahrateSouboryProlnuti,
  prepnoutAktivniPolozky,
  smazatPolozkuAdmin,
  zmenitPoradiPolozek,
  odeslatPushUpozorneni,
  nahraditFotografiiPolozky,
  ulozitUpravyPolozky,
  nahraditSnimekProlnutiPolozky,
  vytvoritZalohu,
  nacistSeznamZaloh,
  obnovitZalohuAdmin,
} from "@/app/admin/actions";
import type { ZalohaInfo } from "@/lib/zaloha/typy";
import { formatovatVelikost } from "@/lib/zaloha/pomocne";
import { BlokDiagnozy } from "./admin/BlokDiagnozy";
import { AdminPrehled } from "./admin/AdminPrehled";
import { AdminSeznamPolozek } from "./admin/AdminSeznamPolozek";
import type { UpravaPolozkyStav } from "./admin/AdminFormularUpravy";
import { AdminPanelUpravy } from "./admin/AdminPanelUpravy";
import { AdminAnalyticsDetail } from "./admin/AdminAnalyticsDetail";
import { AdminNastaveniProlnuti } from "./admin/AdminNastaveniProlnuti";
import { AdminDesktopPozvanka } from "./admin/AdminDesktopPozvanka";
import { AdminVzkazyTreboni } from "./admin/AdminVzkazyTreboni";
import { AdminPotvrzeniSmazani } from "./admin/AdminPotvrzeniSmazani";
import { PROLNUTI_CASOVANI_VYCHOZI } from "@/lib/prolnuti-casovani";
import { DESKTOP_POZVANKA_VYCHOZI_FOTOGRAFIE } from "@/lib/desktop-pozvanka";
import {
  AdminPosledniPublikace,
  KLIC_SESSION_PUSH_ODESLANO,
} from "./admin/AdminPosledniPublikace";

function formatDiagProlnuti(
  pocetUlozenych: number,
  pocetVMeta: number,
  maC: boolean
): string {
  return [
    "prolnutí – diagnostika:",
    `A: ${pocetUlozenych >= 1 ? "ano" : "ne"}`,
    `B: ${pocetUlozenych >= 2 ? "ano" : "ne"}`,
    `C: ${maC ? "ano" : "ne"}`,
    `počet uložených souborů: ${pocetUlozenych}`,
    `počet v metadata: ${pocetVMeta}`,
  ].join("\n");
}

function vytvoritPocatecniUpravu(polozka: Polozka): UpravaPolozkyStav {
  return {
    popis: polozka.popis,
    datumPorizeni: polozka.datumPorizeni?.slice(0, 10) ?? "",
    aktivni: polozka.aktivni,
  };
}

interface AdminPanelProps {
  jePrihlasen: boolean;
  data: AdminData | null;
  chyby: AdminChyby;
}

/**
 * Jednoduchá administrace chráněná heslem.
 * Data se načítají na serveru; metriky a stav úložiště se zobrazují vždy.
 */
export function AdminPanel({ jePrihlasen, data, chyby }: AdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [heslo, setHeslo] = useState("");
  const [chybaAkce, setChybaAkce] = useState("");
  const [nahrava, setNahrava] = useState(false);
  const [nahravaProlnuti, setNahravaProlnuti] = useState(false);
  const [stavNahravaniProlnuti, setStavNahravaniProlnuti] = useState("");
  const [upravyPolozek, setUpravyPolozek] = useState<
    Record<string, UpravaPolozkyStav>
  >({});
  const [ukladaUpravyId, setUkladaUpravyId] = useState<string | null>(null);
  const [nahravaSnimekProlnuti, setNahravaSnimekProlnuti] = useState<{
    id: string;
    snimek: "A" | "B" | "C";
  } | null>(null);
  const [potvrzeniAkce, setPotvrzeniAkce] = useState("");
  const [potvrzeniUrlSouboru, setPotvrzeniUrlSouboru] = useState<string | null>(
    null
  );
  const [odesilaPush, setOdesilaPush] = useState(false);
  const [pushOdeslanoPolozkaId, setPushOdeslanoPolozkaId] = useState<
    string | null
  >(null);
  const [nahrazujeId, setNahrazujeId] = useState<string | null>(null);
  const [zalohy, setZalohy] = useState<ZalohaInfo[]>([]);
  const [nacitaZalohy, setNacitaZalohy] = useState(false);
  const [vytvariZalohu, setVytvariZalohu] = useState(false);
  const [obnovujeZalohu, setObnovujeZalohu] = useState<string | null>(null);
  const [upravovanyId, setUpravovanyId] = useState<string | null>(null);
  const [potvrzeniSmazani, setPotvrzeniSmazani] = useState<{
    id: string;
    popis: string;
  } | null>(null);
  const [mazePolozkuId, setMazePolozkuId] = useState<string | null>(null);
  const posledniPlnePolozky = useRef<Polozka[]>([]);
  const vstupNahraditFotografii = useRef<HTMLInputElement>(null);
  const idKNahrazeni = useRef<string | null>(null);

  useEffect(() => {
    if (data?.polozky && data.polozky.length > 0) {
      posledniPlnePolozky.current = data.polozky;
    }
  }, [data?.polozky]);

  const maChybuNacitani = Boolean(chyby.uloziste || chyby.polozky);
  const polozkyZeServeru = data?.polozky ?? [];
  const polozky =
    polozkyZeServeru.length > 0
      ? polozkyZeServeru
      : maChybuNacitani
        ? posledniPlnePolozky.current
        : polozkyZeServeru;
  const metriky = data?.metriky ?? null;
  const komunita = data?.komunita ?? null;
  const analytics = data?.analytics ?? null;

  const nacistZalohy = async () => {
    setNacitaZalohy(true);
    try {
      const vysledek = await nacistSeznamZaloh();
      if ("uspech" in vysledek && vysledek.uspech) {
        setZalohy(vysledek.zalohy);
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba při načtení seznamu záloh"
      );
    } finally {
      setNacitaZalohy(false);
    }
  };

  useEffect(() => {
    if (jePrihlasen) {
      void nacistZalohy();
    }
  }, [jePrihlasen]);

  useEffect(() => {
    if (!jePrihlasen) return;
    const ulozeno = sessionStorage.getItem(KLIC_SESSION_PUSH_ODESLANO);
    if (ulozeno) {
      setPushOdeslanoPolozkaId(ulozeno);
    }
  }, [jePrihlasen]);

  const trvaleUloziste = data?.trvaleUloziste ?? false;
  const lzeVytvoritZalohu = data?.lzeVytvoritZalohu ?? false;
  const diagnoza = data?.diagnoza ?? null;
  const posledniAktivniPolozka = polozky.find((p) => p.aktivni) ?? null;
  const upravovanaPolozka = upravovanyId
    ? (polozky.find((p) => p.id === upravovanyId) ?? null)
    : null;
  const upravaPolozky = upravovanyId
    ? (upravyPolozek[upravovanyId] ?? null)
    : null;
  const pushOdeslano =
    posledniAktivniPolozka !== null &&
    pushOdeslanoPolozkaId === posledniAktivniPolozka.id;
  const probihaNahradiFotografii = nahrazujeId !== null;

  const obnovit = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const zpracovatChybuAkce = (vysledek: { chyba?: string; uspech?: boolean }) => {
    if ("chyba" in vysledek && vysledek.chyba) {
      setChybaAkce(vysledek.chyba);
      setPotvrzeniAkce("");
      setPotvrzeniUrlSouboru(null);
      return false;
    }
    setChybaAkce("");
    return true;
  };

  const handlePrihlaseni = async (e: React.FormEvent) => {
    e.preventDefault();
    setChybaAkce("");

    const vysledek = await prihlasitAdmin(heslo);
    if ("uspech" in vysledek && vysledek.uspech) {
      setHeslo("");
      obnovit();
    } else {
      setChybaAkce(vysledek.chyba ?? "Neplatné heslo");
    }
  };

  const handleOdhlaseni = async () => {
    await odhlasitAdmin();
    obnovit();
  };

  const handleNahrani = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNahrava(true);
    setChybaAkce("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const vysledek = await nahratPolozku(formData);
      if ("uspech" in vysledek && vysledek.uspech) {
        setChybaAkce("");
        form.reset();
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při nahrávání"
      );
    }

    setNahrava(false);
  };

  const handleNahraniProlnuti = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNahravaProlnuti(true);
    setStavNahravaniProlnuti("");
    setChybaAkce("");
    setPotvrzeniAkce("");

    const form = e.currentTarget;
    const popisInput = form.elements.namedItem("popis") as HTMLInputElement | null;
    const datumInput = form.elements.namedItem(
      "datumPorizeni"
    ) as HTMLInputElement | null;
    const inputA = form.elements.namedItem("souborA") as HTMLInputElement | null;
    const inputB = form.elements.namedItem("souborB") as HTMLInputElement | null;
    const inputC = form.elements.namedItem("souborC") as HTMLInputElement | null;
    const fileA = inputA?.files?.[0];
    const fileB = inputB?.files?.[0];
    const fileC = inputC?.files?.[0];

    if (!fileA?.size) {
      setChybaAkce("Pro prolnutí chybí první fotografie (A)");
      setNahravaProlnuti(false);
      return;
    }

    if (!fileB?.size) {
      setChybaAkce("Pro prolnutí chybí druhá fotografie (B)");
      setNahravaProlnuti(false);
      return;
    }

    const souboryKNahrani: { snimek: "A" | "B" | "C"; soubor: File }[] = [
      { snimek: "A", soubor: fileA },
      { snimek: "B", soubor: fileB },
    ];
    if (fileC?.size) {
      souboryKNahrani.push({ snimek: "C", soubor: fileC });
    }

    const nahrateCesty: string[] = [];
    const operaceId = crypto.randomUUID();

    try {
      for (const { snimek, soubor } of souboryKNahrani) {
        setStavNahravaniProlnuti(`nahrávám snímek ${snimek}…`);

        const formData = new FormData();
        formData.set("soubor", soubor, soubor.name);
        formData.set("operaceId", operaceId);
        formData.set("snimek", snimek);

        const vysledek = await nahratSouborGalerie(formData);
        if ("chyba" in vysledek) {
          throw new Error(vysledek.chyba);
        }
        if (vysledek.typ !== "fotografie") {
          throw new Error(
            "Prolnutí podporuje pouze fotografie (JPEG, PNG, WebP, AVIF)"
          );
        }

        nahrateCesty.push(vysledek.cestaSouboru);
      }

      setStavNahravaniProlnuti("ukládám metadata prolnutí…");

      const vysledek = await vytvoritProlnutiAdmin({
        operaceId,
        soubory: nahrateCesty,
        popis: popisInput?.value ?? "",
        datumPorizeni: datumInput?.value || null,
      });

      if ("uspech" in vysledek && vysledek.uspech) {
        setChybaAkce("");
        setPotvrzeniAkce(
          vysledek.diagProlnuti
            ? `Prolnutí bylo nahráno (${vysledek.diagProlnuti.pocetSouboruVMeta} snímků) a je viditelné na webu.`
            : "Prolnutí bylo nahráno a je viditelné na webu."
        );
        form.reset();
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        if (vysledek.diagProlnuti) {
          setPotvrzeniAkce(
            formatDiagProlnuti(
              vysledek.diagProlnuti.pocetUlozenychSouboru,
              vysledek.diagProlnuti.pocetSouboruVMeta,
              vysledek.diagProlnuti.maC
            )
          );
        }
        setChybaAkce(vysledek.chyba);
      } else {
        setChybaAkce("Neočekávaná odpověď serveru při nahrávání prolnutí");
      }
    } catch (error) {
      if (nahrateCesty.length > 0) {
        await smazatNahrateSouboryProlnuti(nahrateCesty, {
          operaceId,
          duvod:
            error instanceof Error
              ? error.message
              : "Neočekávaná chyba při nahrávání prolnutí",
        });
      }

      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při nahrávání prolnutí"
      );
    } finally {
      setNahravaProlnuti(false);
      setStavNahravaniProlnuti("");
    }
  };

  const handlePrepnoutAktivni = async (id: string, aktivni: boolean) => {
    const vysledek = await prepnoutAktivniPolozky(id, !aktivni);
    if (zpracovatChybuAkce(vysledek)) obnovit();
  };

  const handlePozadavekSmazani = (id: string) => {
    const polozka = polozky.find((p) => p.id === id);
    setPotvrzeniSmazani({
      id,
      popis: polozka?.popis || "bez názvu",
    });
  };

  const handlePotvrditSmazani = async () => {
    if (!potvrzeniSmazani) return;

    const { id } = potvrzeniSmazani;
    setMazePolozkuId(id);
    setChybaAkce("");

    try {
      const vysledek = await smazatPolozkuAdmin(id);
      if (zpracovatChybuAkce(vysledek)) {
        setPotvrzeniSmazani(null);
        if (upravovanyId === id) {
          setUpravovanyId(null);
        }
        obnovit();
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při mazání"
      );
    } finally {
      setMazePolozkuId(null);
    }
  };

  const handleUlozitUpravy = async (id: string) => {
    const uprava = upravyPolozek[id];
    if (!uprava) return;

    setUkladaUpravyId(id);
    setChybaAkce("");

    try {
      const vysledek = await ulozitUpravyPolozky(id, {
        popis: uprava.popis,
        datumPorizeni: uprava.datumPorizeni || null,
        aktivni: uprava.aktivni,
      });
      if (zpracovatChybuAkce(vysledek)) {
        setPotvrzeniAkce("Změny položky byly uloženy.");
        setUpravovanyId(null);
        obnovit();
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při ukládání úprav"
      );
    } finally {
      setUkladaUpravyId(null);
    }
  };

  const handleNahraditSnimekProlnuti = async (
    id: string,
    snimek: "A" | "B" | "C",
    soubor: File
  ) => {
    setNahravaSnimekProlnuti({ id, snimek });
    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);

    const formData = new FormData();
    formData.set("soubor", soubor);

    try {
      const vysledek = await nahraditSnimekProlnutiPolozky(id, snimek, formData);
      if ("uspech" in vysledek && vysledek.uspech) {
        setPotvrzeniAkce(
          `Snímek ${snimek} prolnutí byl nahrazen. Metadata v úložišti byla přepsána.`
        );
        setPotvrzeniUrlSouboru(vysledek.novaUrlSouboru ?? null);
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při nahrazování snímku prolnutí"
      );
    } finally {
      setNahravaSnimekProlnuti(null);
    }
  };

  const handleNahraditFotografii = (id: string) => {
    if (probihaNahradiFotografii) return;

    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);
    setNahrazujeId(id);
    idKNahrazeni.current = id;
    vstupNahraditFotografii.current?.click();
  };

  const handleVybranNahradniSoubor = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const id = idKNahrazeni.current;
    const soubor = e.target.files?.[0];
    e.target.value = "";

    if (!id || !soubor) {
      idKNahrazeni.current = null;
      setNahrazujeId(null);
      return;
    }

    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);

    const formData = new FormData();
    formData.set("soubor", soubor);

    try {
      const vysledek = await nahraditFotografiiPolozky(id, formData);
      if ("uspech" in vysledek && vysledek.uspech) {
        setPotvrzeniAkce(
          "Fotografie byla nahrazena. Metadata v úložišti byla přepsána."
        );
        setPotvrzeniUrlSouboru(vysledek.novaUrlSouboru ?? null);
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při nahrazování fotografie"
      );
    } finally {
      idKNahrazeni.current = null;
      setNahrazujeId(null);
    }
  };

  const handlePosun = async (index: number, smer: "nahoru" | "dolu") => {
    const noveIds = polozky.map((p) => p.id);
    const cil = smer === "nahoru" ? index - 1 : index + 1;
    if (cil < 0 || cil >= noveIds.length) return;

    [noveIds[index], noveIds[cil]] = [noveIds[cil], noveIds[index]];
    const vysledek = await zmenitPoradiPolozek(noveIds);
    if (zpracovatChybuAkce(vysledek)) obnovit();
  };

  const handlePripnoutNahoru = async (index: number) => {
    if (index <= 0) return;

    const noveIds = polozky.map((p) => p.id);
    const [id] = noveIds.splice(index, 1);
    noveIds.unshift(id);

    const vysledek = await zmenitPoradiPolozek(noveIds);
    if (zpracovatChybuAkce(vysledek)) obnovit();
  };

  const handleOdeslatPush = async (id: string) => {
    setOdesilaPush(true);
    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);

    try {
      const vysledek = await odeslatPushUpozorneni(id);

      if ("zadniOdberatele" in vysledek && vysledek.zadniOdberatele) {
        setPotvrzeniAkce("Žádní odběratelé push upozornění.");
        return;
      }

      if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
        return;
      }

      if ("uspech" in vysledek && vysledek.uspech) {
        setPushOdeslanoPolozkaId(id);
        sessionStorage.setItem(KLIC_SESSION_PUSH_ODESLANO, id);

        const { pocetOdeslano, pocetSelhalo } = vysledek;
        if (pocetSelhalo > 0) {
          setPotvrzeniAkce(
            `Upozornění odesláno ${pocetOdeslano} odběratelům (${pocetSelhalo} se nepodařilo).`
          );
        } else {
          setPotvrzeniAkce(
            `Upozornění odesláno ${pocetOdeslano} ${
              pocetOdeslano === 1 ? "odběrateli" : "odběratelům"
            }.`
          );
        }
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při odesílání upozornění"
      );
    } finally {
      setOdesilaPush(false);
    }
  };

  const handleVytvoritZalohu = async () => {
    setVytvariZalohu(true);
    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);

    try {
      const vysledek = await vytvoritZalohu();
      if ("uspech" in vysledek && vysledek.uspech) {
        const doBlobu = vysledek.zaloha.url.startsWith("http");
        const ulozeni = doBlobu
          ? "Záloha vytvořena"
          : "Záloha vytvořena a uložena lokálně";
        setPotvrzeniAkce(
          `${ulozeni} (${formatovatVelikost(vysledek.zaloha.velikost)}).`
        );
        await nacistZalohy();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba při vytváření zálohy"
      );
    } finally {
      setVytvariZalohu(false);
    }
  };

  const handleStahnoutZalohu = (pathname: string) => {
    const url = `/api/admin/zaloha/stahnout?pathname=${encodeURIComponent(pathname)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleObnovitZalohu = async (zaloha: ZalohaInfo) => {
    const potvrzeni = [
      "Obnovit galerii ze zálohy?",
      "",
      `Záloha: ${zaloha.nazev}`,
      `Vytvořeno: ${new Date(zaloha.vytvoreno).toLocaleString("cs-CZ")}`,
      "",
      "Aktuální metadata, fotografie, push odběratelé a metriky budou přepsány.",
    ].join("\n");

    if (!confirm(potvrzeni)) return;

    setObnovujeZalohu(zaloha.pathname);
    setChybaAkce("");
    setPotvrzeniAkce("");
    setPotvrzeniUrlSouboru(null);

    try {
      const vysledek = await obnovitZalohuAdmin(zaloha.pathname);
      if ("uspech" in vysledek && vysledek.uspech) {
        setPotvrzeniAkce(
          `Obnova dokončena: ${vysledek.polozky} položek, ${vysledek.soubory} souborů, ${vysledek.pushOdbery} push odběratelů.`
        );
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba při obnově ze zálohy"
      );
    } finally {
      setObnovujeZalohu(null);
    }
  };

  const handleUpravit = (id: string) => {
    const polozka = polozky.find((p) => p.id === id);
    if (polozka) {
      setUpravyPolozek((u) => ({
        ...u,
        [id]: vytvoritPocatecniUpravu(polozka),
      }));
    }
    setUpravovanyId(id);
  };

  const handleZrusitUpravy = () => {
    setUpravovanyId(null);
  };

  const handleZmenaUpravy = (
    id: string,
    zmena: Partial<UpravaPolozkyStav>
  ) => {
    setUpravyPolozek((predchozi) => ({
      ...predchozi,
      [id]: {
        ...predchozi[id],
        ...zmena,
      },
    }));
  };

  const formatovatDatumZalohy = (iso: string) =>
    new Date(iso).toLocaleString("cs-CZ", {
      dateStyle: "short",
      timeStyle: "medium",
    });

  if (!jePrihlasen) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-krem px-6">
        <form onSubmit={handlePrihlaseni} className="w-full max-w-xs space-y-4">
          <h1 className="text-center text-lg font-light text-text">
            administrace
          </h1>
          <input
            type="password"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            placeholder="heslo"
            className="w-full border border-text-velmiJemny/30 bg-transparent px-4 py-2 text-sm text-text outline-none focus:border-text-jemny/50"
          />
          {chybaAkce && (
            <p className="text-center text-xs text-red-400">{chybaAkce}</p>
          )}
          <button type="submit" className="tlacitko-klidne w-full">
            přihlásit se
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-krem px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-light text-text">administrace</h1>
          <button type="button" onClick={handleOdhlaseni} className="odkaz-jemny">
            odhlásit se
          </button>
        </div>

        {probihaNahradiFotografii && (
          <p className="text-center text-xs text-text-jemny">
            Probíhá nahrávání...
          </p>
        )}

        {(pending || nahrava) && !probihaNahradiFotografii && (
          <p className="text-center text-xs text-text-velmiJemny">obnovuji…</p>
        )}

        <input
          ref={vstupNahraditFotografii}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleVybranNahradniSoubor}
        />

        {chybaAkce && (
          <div className="rounded border border-red-400/30 bg-red-50/50 p-3 text-center text-xs text-red-500">
            <p className="font-medium">chyba operace</p>
            <p className="mt-1">{chybaAkce}</p>
          </div>
        )}

        {potvrzeniAkce && (
          <div className="rounded border border-text-velmiJemny/30 bg-krem-tmavsi/30 p-3 text-center text-xs text-text-jemny">
            <p className="whitespace-pre-line">{potvrzeniAkce}</p>
            {potvrzeniUrlSouboru && (
              <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-text-velmiJemny">
                {potvrzeniUrlSouboru}
              </p>
            )}
          </div>
        )}

        <AdminPosledniPublikace
          polozka={posledniAktivniPolozka}
          pushOdeslano={pushOdeslano}
          odesilaPush={odesilaPush}
          onOdeslatPush={handleOdeslatPush}
        />

        {(chyby.uloziste || chyby.polozky) && (
          <div className="rounded border border-red-400/30 bg-red-50/50 p-3 text-xs text-red-500">
            <p className="font-medium text-center">chyba načtení dat</p>
            {chyby.uloziste && <p className="mt-1">{chyby.uloziste}</p>}
            {chyby.polozky && chyby.polozky !== chyby.uloziste && (
              <p className="mt-1">{chyby.polozky}</p>
            )}
            {polozky.length > 0 && polozkyZeServeru.length === 0 && (
              <p className="mt-2 text-center text-text-jemny">
                zobrazen poslední známý seznam ({polozky.length} položek) – obnovte
                stránku po opravě
              </p>
            )}
          </div>
        )}

        {/* Stav úložiště – vždy viditelný */}
        <section className="space-y-2 text-center text-xs font-light">
          {trvaleUloziste ? (
            <p className="text-text-velmiJemny">
              trvalé úložiště aktivní – fotografie a změny se ukládají
            </p>
          ) : diagnoza && !diagnoza.lzeZalohovat ? (
            <p className="text-amber-700/80">
              trvalé úložiště není plně aktivní – zápisy z administrace mohou
              selhat (viz diagnostika)
            </p>
          ) : null}
          {diagnoza && <BlokDiagnozy diagnoza={diagnoza} />}
        </section>

        {/* Metriky a top položky */}
        <AdminPrehled
          metriky={metriky}
          komunita={komunita}
          analytics={analytics}
          polozky={polozky}
          chybaMetriky={chyby.metriky}
        />

        <AdminPanelUpravy
          polozka={upravovanaPolozka}
          uprava={upravaPolozky}
          uklada={ukladaUpravyId === upravovanyId}
          nahravaSnimek={
            nahravaSnimekProlnuti?.id === upravovanyId
              ? nahravaSnimekProlnuti.snimek
              : null
          }
          onZmena={(zmena) => {
            if (upravovanyId) handleZmenaUpravy(upravovanyId, zmena);
          }}
          onUlozit={() => {
            if (upravovanyId) void handleUlozitUpravy(upravovanyId);
          }}
          onZrusit={handleZrusitUpravy}
          onNahraditSnimek={(snimek, soubor) => {
            if (upravovanyId) {
              void handleNahraditSnimekProlnuti(upravovanyId, snimek, soubor);
            }
          }}
        />

        <AdminSeznamPolozek
          polozky={polozky}
          analytics={analytics}
          upravovanyId={upravovanyId}
          nahrazujeId={nahrazujeId}
          probihaNahradiFotografii={probihaNahradiFotografii}
          chybaPolozky={chyby.polozky}
          maChybuNacitani={maChybuNacitani}
          onUpravit={handleUpravit}
          onPosun={handlePosun}
          onPripnoutNahoru={(index) => void handlePripnoutNahoru(index)}
          onPrepnoutAktivni={handlePrepnoutAktivni}
          onSmazat={handlePozadavekSmazani}
          onNahraditFotografii={handleNahraditFotografii}
        />

        <section className="space-y-3 border border-text-velmiJemny/20 p-4">
          <h2 className="text-sm font-light text-text-jemny">nahrát položku</h2>
          <form onSubmit={handleNahrani} className="space-y-3">
            <input
              type="file"
              name="soubor"
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              required
              className="w-full text-xs text-text-jemny"
            />
            <input
              type="text"
              name="popis"
              placeholder="popis (malými písmeny, bez tečky)"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <input
              type="date"
              name="datumPorizeni"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <button type="submit" disabled={nahrava} className="tlacitko-klidne">
              {nahrava ? "nahrávání…" : "nahrát fotografii"}
            </button>
          </form>
        </section>

        <section className="space-y-3 border border-text-velmiJemny/20 p-4">
          <h2 className="text-sm font-light text-text-jemny">nahrát prolnutí</h2>
          <p className="text-xs text-text-velmiJemny">
            2–3 snímky stejného místa – první chvíli klid, pak postupné prolínání
          </p>
          <form onSubmit={handleNahraniProlnuti} className="space-y-3">
            <label className="block text-xs text-text-velmiJemny">
              první fotografie (A)
              <input
                type="file"
                name="souborA"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
                className="mt-1 w-full text-xs text-text-jemny"
              />
            </label>
            <label className="block text-xs text-text-velmiJemny">
              druhá fotografie (B)
              <input
                type="file"
                name="souborB"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
                className="mt-1 w-full text-xs text-text-jemny"
              />
            </label>
            <label className="block text-xs text-text-velmiJemny">
              třetí fotografie (C, volitelné)
              <input
                type="file"
                name="souborC"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="mt-1 w-full text-xs text-text-jemny"
              />
            </label>
            <input
              type="text"
              name="popis"
              placeholder="popis (malými písmeny, bez tečky)"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <input
              type="date"
              name="datumPorizeni"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <button
              type="submit"
              disabled={nahravaProlnuti}
              className="tlacitko-klidne"
            >
              {nahravaProlnuti
                ? stavNahravaniProlnuti || "nahrávání…"
                : "nahrát prolnutí"}
            </button>
          </form>
        </section>

        <AdminNastaveniProlnuti
          casovani={data?.prolnutiCasovani ?? PROLNUTI_CASOVANI_VYCHOZI}
          onUlozeno={obnovit}
          onChyba={setChybaAkce}
          onPotvrzeni={setPotvrzeniAkce}
        />

        <AdminDesktopPozvanka
          fotografieUrl={
            data?.desktopPozvankaFotografieUrl ?? DESKTOP_POZVANKA_VYCHOZI_FOTOGRAFIE
          }
          maVlastniFotografii={Boolean(data?.desktopPozvankaFotografie)}
          onUlozeno={obnovit}
          onChyba={setChybaAkce}
          onPotvrzeni={setPotvrzeniAkce}
        />

        <AdminVzkazyTreboni vzkazy={data?.vzkazyTreboni ?? []} />

        <section className="space-y-3 border border-text-velmiJemny/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-light text-text-jemny">zálohy</h2>
            <button
              type="button"
              onClick={() => void nacistZalohy()}
              disabled={nacitaZalohy || vytvariZalohu}
              className="text-xs text-text-velmiJemny disabled:opacity-30"
            >
              {nacitaZalohy ? "načítám…" : "obnovit seznam"}
            </button>
          </div>
          <p className="text-xs text-text-velmiJemny">
            Ruční záloha obsahuje fotografie, metadata galerie, push odběratele,
            metriky návštěvnosti a netajná nastavení projektu.
          </p>
          <button
            type="button"
            onClick={() => void handleVytvoritZalohu()}
            disabled={!lzeVytvoritZalohu || vytvariZalohu || obnovujeZalohu !== null}
            className="tlacitko-klidne"
          >
            {vytvariZalohu ? "vytvářím zálohu…" : "vytvořit zálohu"}
          </button>
          {!lzeVytvoritZalohu && (
            <p className="text-xs text-amber-700/80">
              Zálohování vyžaduje aktivní Blob úložiště nebo lokální soubory.
            </p>
          )}
          {diagnoza?.lzeZalohovat && !diagnoza.zalohaDoBlobu && (
            <p className="text-xs text-text-velmiJemny">
              Záloha se uloží lokálně do data/backups/manual/.
            </p>
          )}
          {zalohy.length === 0 && !nacitaZalohy && lzeVytvoritZalohu && (
            <p className="text-xs text-text-velmiJemny">žádné zálohy</p>
          )}
          {zalohy.length > 0 && (
            <ul className="space-y-2">
              {zalohy.map((zaloha) => (
                <li
                  key={zaloha.pathname}
                  className="flex flex-col gap-2 border border-text-velmiJemny/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-xs text-text-velmiJemny">
                    <p className="truncate font-mono text-[11px] text-text">
                      {zaloha.nazev}
                    </p>
                    <p>
                      {formatovatDatumZalohy(zaloha.vytvoreno)} ·{" "}
                      {formatovatVelikost(zaloha.velikost)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => handleStahnoutZalohu(zaloha.pathname)}
                      className="text-xs text-text-velmiJemny"
                    >
                      stáhnout
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleObnovitZalohu(zaloha)}
                      disabled={obnovujeZalohu === zaloha.pathname || vytvariZalohu}
                      className="text-xs text-red-400/70 disabled:opacity-30"
                    >
                      {obnovujeZalohu === zaloha.pathname
                        ? "obnovuji…"
                        : "obnovit"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AdminAnalyticsDetail
          analytics={analytics}
          pocetPushOdberu={data?.pocetPushOdberu ?? 0}
          metrikyPush={metriky?.pocetPovolenychUpozorneni}
        />
      </div>

      {potvrzeniSmazani && (
        <AdminPotvrzeniSmazani
          popis={potvrzeniSmazani.popis}
          probiha={mazePolozkuId === potvrzeniSmazani.id}
          onZrusit={() => setPotvrzeniSmazani(null)}
          onPotvrdit={() => void handlePotvrditSmazani()}
        />
      )}
    </div>
  );
}
