"use client";

import { useState, useTransition } from "react";
import {
  nastavitBranaAtmosferaRucniTextAkce,
  ulozitBranaAtmosferaDovetekAkce,
  zrusitBranaAtmosferaDovetekAkce,
  zrusitBranaAtmosferaRucniTextAkce,
} from "@/app/brana/admin/actions";
import { BranaAtmosferaDnes } from "@/components/brana/BranaAtmosferaDnes";
import {
  BRANA_ATMOSFERA_DOVETEK_MAX,
  BRANA_ATMOSFERA_RUCNI_TEXT_MAX,
  normalizovatDovetekAtmosfery,
  slozitTextDovetkuAtmosfery,
  verejnaVetaAtmosfery,
  verejnaVetaZDokumentuAtmosfery,
  type BranaAtmosferaDokument,
} from "@/lib/brana/atmosfera";

const VSTUP =
  "w-full max-w-lg border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

const TLACITKO =
  "border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50";

type Props = {
  pocatecni: BranaAtmosferaDokument | null;
  chybaCteni: string | null;
  uloziteniPovoleno: boolean;
};

function formatCas(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(t));
}

export function BranaAdminAtmosfera({
  pocatecni,
  chybaCteni,
  uloziteniPovoleno,
}: Props) {
  const [dokument, setDokument] = useState(pocatecni);
  const [text, setText] = useState("");
  const [dovetek, setDovetek] = useState("");
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [probiha, startTransition] = useTransition();

  const automatickaVeta = dokument
    ? verejnaVetaAtmosfery(dokument.stav)
    : null;
  const rucniAktivni = Boolean(dokument?.rucniText?.trim());
  const slozenyDovetek = slozitTextDovetkuAtmosfery(dovetek);
  const validaceDovetku = normalizovatDovetekAtmosfery(dovetek);
  const nahledVeta =
    automatickaVeta && slozenyDovetek
      ? `${automatickaVeta} ${slozenyDovetek}`
      : automatickaVeta;
  const zverejneno = dokument
    ? verejnaVetaZDokumentuAtmosfery(dokument)
    : null;
  const dovetekUlozeny = Boolean(dokument?.dovetekText);

  const zobrazitRucne = () => {
    setHlaska(null);
    setChyba(null);
    startTransition(async () => {
      const vysledek = await nastavitBranaAtmosferaRucniTextAkce(text);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setDokument(vysledek.dokument);
      setText("");
      setHlaska("Ruční text je aktivní na veřejném DNES.");
    });
  };

  const zrusitRucni = () => {
    setHlaska(null);
    setChyba(null);
    startTransition(async () => {
      const vysledek = await zrusitBranaAtmosferaRucniTextAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setDokument(vysledek.dokument);
      setHlaska("Ruční text zrušen. Platí znovu automatický stav.");
    });
  };

  const ulozitDovetek = () => {
    if (!dokument) return;
    setHlaska(null);
    setChyba(null);
    const stavPriUlozeni = dokument.stav;
    startTransition(async () => {
      const vysledek = await ulozitBranaAtmosferaDovetekAkce(
        dovetek,
        stavPriUlozeni,
      );
      if (vysledek.dokument) {
        setDokument(vysledek.dokument);
      }
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setDovetek("");
      setHlaska("Dovětek je uložený.");
    });
  };

  const odstranitDovetek = () => {
    setHlaska(null);
    setChyba(null);
    startTransition(async () => {
      const vysledek = await zrusitBranaAtmosferaDovetekAkce();
      if (vysledek.dokument) {
        setDokument(vysledek.dokument);
      }
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setHlaska("Dovětek je odstraněný.");
    });
  };

  return (
    <section className="space-y-6" aria-labelledby="brana-admin-atmosfera-nadpis">
      <h2
        id="brana-admin-atmosfera-nadpis"
        className="text-base font-normal text-text"
      >
        Atmosféra
      </h2>

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      {hlaska ? (
        <p className="text-sm text-text-jemny" role="status">
          {hlaska}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-text">Automaticky nyní:</p>
        <p className="text-sm text-text">
          {dokument
            ? automatickaVeta ?? "NIC — veřejně skryto"
            : "Stav se nepodařilo načíst."}
        </p>
        <p className="text-sm text-text-jemny">
          Poslední automatická kontrola:{" "}
          {formatCas(dokument?.zkontrolovanoAt ?? null)}
        </p>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-text">Ruční text</span>
          <textarea
            className={VSTUP}
            rows={3}
            maxLength={BRANA_ATMOSFERA_RUCNI_TEXT_MAX}
            value={text}
            disabled={!uloziteniPovoleno || probiha}
            onChange={(e) => setText(e.target.value)}
            placeholder="Např. Právě se staví májka."
          />
          <span className="block text-xs text-text-jemny">
            {text.trim().length}/{BRANA_ATMOSFERA_RUCNI_TEXT_MAX}
          </span>
        </label>
        <button
          type="button"
          className={TLACITKO}
          disabled={!uloziteniPovoleno || probiha || !text.trim()}
          onClick={zobrazitRucne}
        >
          Zobrazit ručně
        </button>
      </div>

      {rucniAktivni ? (
        <div className="space-y-3 border-t border-text-velmiJemny/15 pt-4">
          <p className="text-sm font-medium text-text">Aktivní ruční text:</p>
          <p className="text-sm text-text">{dokument?.rucniText}</p>
          <p className="text-sm text-text-jemny">
            Nastaveno: {formatCas(dokument?.rucniTextAt ?? null)}
          </p>
          <button
            type="button"
            className={TLACITKO}
            disabled={!uloziteniPovoleno || probiha}
            onClick={zrusitRucni}
          >
            Zrušit ruční text
          </button>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-text-velmiJemny/15 pt-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-text">
            Dovětek k automatickému textu
          </span>
          <textarea
            className={VSTUP}
            rows={2}
            maxLength={BRANA_ATMOSFERA_DOVETEK_MAX}
            value={dovetek}
            disabled={!uloziteniPovoleno || probiha || !automatickaVeta}
            onChange={(e) => setDovetek(e.target.value)}
            placeholder="Např. Podloubím se nese hudba."
          />
          <span className="block text-xs text-text-jemny">
            {slozenyDovetek.length}/{BRANA_ATMOSFERA_DOVETEK_MAX}
          </span>
        </label>
        <button
          type="button"
          className={TLACITKO}
          disabled={
            !uloziteniPovoleno ||
            probiha ||
            !dokument ||
            !automatickaVeta ||
            !validaceDovetku.ok
          }
          onClick={ulozitDovetek}
        >
          Uložit dovětek
        </button>

        <div className="max-w-md bg-[#0a1420] px-6 py-4">
          <p className="mb-2 text-xs leading-snug text-white/70">
            Živý náhled — zatím nezveřejněno
          </p>
          {nahledVeta ? (
            <BranaAtmosferaDnes veta={nahledVeta} />
          ) : (
            <p className="text-sm leading-snug text-white/80">
              Automatická věta teď není k dispozici. Dovětek nelze uložit.
            </p>
          )}
        </div>

        {rucniAktivni ? (
          <p className="text-sm text-text">
            Úplný ruční text má veřejně přednost. Dovětek se na BRÁNĚ
            nezobrazuje, dokud ruční text platí.
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Zveřejněno na DNES</p>
          {zverejneno ? (
            <div className="max-w-md bg-[#0a1420] px-6 py-4">
              <BranaAtmosferaDnes veta={zverejneno} />
            </div>
          ) : (
            <p className="text-sm text-text">
              Atmosféra se veřejně nezobrazuje.
            </p>
          )}
        </div>

        {dovetekUlozeny ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text">Uložený dovětek</p>
            <p className="text-sm text-text">{dokument?.dovetekText}</p>
            <p className="text-sm text-text-jemny">
              Uložen: {formatCas(dokument?.dovetekAt ?? null)}
            </p>
            <button
              type="button"
              className={TLACITKO}
              disabled={!uloziteniPovoleno || probiha}
              onClick={odstranitDovetek}
            >
              Odstranit dovětek
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
