"use client";

import { useState, useTransition } from "react";
import { ulozitBranaUpozorneniNastaveniAkce } from "@/app/brana/admin/actions";
import type { BranaUpozorneniNastaveniDokument } from "@/lib/brana/admin/upozorneni-uloziste";

const VSTUP =
  "w-full max-w-md border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

type Props = {
  pocatecni: BranaUpozorneniNastaveniDokument;
  uloziteniPovoleno: boolean;
  chybaCteni?: string | null;
};

/**
 * Jednoduché nastavení budoucího Scanování + Upozornění.
 * Neodesílá SMS; pouze ukládá PRIVATE admin data.
 */
export function BranaAdminUpozorneniFormulare({
  pocatecni,
  uloziteniPovoleno,
  chybaCteni = null,
}: Props) {
  const [telefon, setTelefon] = useState(pocatecni.telefon);
  const [upozorneniAktivni, setUpozorneniAktivni] = useState(
    pocatecni.upozorneniAktivni,
  );
  const [pristiDlouhodobaKontrola, setPristiDlouhodobaKontrola] = useState(
    pocatecni.pristiDlouhodobaKontrola ?? "",
  );
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [ulozeno, setUlozeno] = useState(false);
  const [pending, startTransition] = useTransition();

  function ulozit() {
    if (!uloziteniPovoleno || pending) {
      return;
    }

    setChyba(null);
    setUlozeno(false);

    startTransition(async () => {
      const vysledek = await ulozitBranaUpozorneniNastaveniAkce({
        telefon,
        upozorneniAktivni,
        pristiDlouhodobaKontrola: pristiDlouhodobaKontrola.trim()
          ? pristiDlouhodobaKontrola.trim()
          : null,
      });
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setTelefon(vysledek.dokument.telefon);
      setUpozorneniAktivni(vysledek.dokument.upozorneniAktivni);
      setPristiDlouhodobaKontrola(
        vysledek.dokument.pristiDlouhodobaKontrola ?? "",
      );
      setUlozeno(true);
    });
  }

  return (
    <div className="space-y-6" aria-label="Nastavení upozornění">
      <div className="space-y-3">
        <label className="block space-y-1 text-sm text-text">
          <span className="text-text-jemny">Telefon pro upozornění</span>
          <input
            type="tel"
            className={VSTUP}
            value={telefon}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => {
              setTelefon(e.target.value);
              setUlozeno(false);
            }}
            autoComplete="tel"
            inputMode="tel"
            aria-label="Telefon pro upozornění"
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-sm text-text-jemny">Upozornění</legend>
          <div className="flex flex-wrap gap-4 text-sm text-text">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="brana-upozorneni-stav"
                checked={upozorneniAktivni}
                disabled={!uloziteniPovoleno || pending}
                onChange={() => {
                  setUpozorneniAktivni(true);
                  setUlozeno(false);
                }}
              />
              AKTIVNÍ
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="brana-upozorneni-stav"
                checked={!upozorneniAktivni}
                disabled={!uloziteniPovoleno || pending}
                onChange={() => {
                  setUpozorneniAktivni(false);
                  setUlozeno(false);
                }}
              />
              VYPNUTO
            </label>
          </div>
        </fieldset>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">Rychlé zdroje</h3>
        <p className="text-sm text-text">Pondělí · 9:00</p>
        <p className="text-sm text-text">Čtvrtek · 9:00</p>
        <p className="text-sm text-text-jemny">
          Europe/Prague · budoucí automatický scan (zatím neběží)
        </p>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">
          Dlouhodobé zdroje
        </h3>
        <p className="text-sm text-text">
          Každých 21 dní · pondělí · 9:00
        </p>
        <p className="text-sm text-text-jemny">
          Kontrola zdrojů + budoucí schválení/publikování Kalendáře (zatím
          neběží)
        </p>
      </div>

      <label className="block space-y-1 text-sm text-text">
        <span className="text-text-jemny">Příští dlouhodobá kontrola</span>
        <input
          type="date"
          className={VSTUP}
          value={pristiDlouhodobaKontrola}
          disabled={!uloziteniPovoleno || pending}
          onChange={(e) => {
            setPristiDlouhodobaKontrola(e.target.value);
            setUlozeno(false);
          }}
          aria-label="Příští dlouhodobá kontrola"
        />
        <span className="block text-sm text-text-jemny">
          Musí být pondělí. Čas je systémově 9:00 Europe/Prague.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="border border-text-velmiJemny/40 px-3 py-1.5 text-sm text-text disabled:opacity-50"
          disabled={!uloziteniPovoleno || pending}
          onClick={ulozit}
        >
          {pending ? "Ukládám…" : "Uložit"}
        </button>
        {ulozeno ? (
          <p className="text-sm text-text-jemny" role="status">
            Uloženo.
          </p>
        ) : null}
      </div>

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
    </div>
  );
}
