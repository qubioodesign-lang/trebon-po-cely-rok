"use client";

import { useState, useTransition } from "react";
import {
  ulozitBranaPushSubscriptionAkce,
  ulozitBranaUpozorneniPristiKontroluAkce,
  vypnoutBranaPushSubscriptionAkce,
} from "@/app/brana/admin/actions";
import type { BranaUpozorneniNastaveniProUi } from "@/lib/brana/admin/upozorneni-uloziste";
import {
  odhlasitBranaPushSubscriptionVProhlizeci,
  vytvoritBranaPushSubscription,
} from "@/lib/brana/admin/push-subscription-klient";

const VSTUP =
  "w-full max-w-md border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

type Props = {
  pocatecni: BranaUpozorneniNastaveniProUi;
  uloziteniPovoleno: boolean;
  chybaCteni?: string | null;
};

/**
 * Nastavení interního Web Push + kotvy dlouhodobé kontroly.
 * Neodesílá push; pouze PRIVATE subscription a datum.
 */
export function BranaAdminUpozorneniFormulare({
  pocatecni,
  uloziteniPovoleno,
  chybaCteni = null,
}: Props) {
  const [upozorneniAktivni, setUpozorneniAktivni] = useState(
    pocatecni.upozorneniAktivni,
  );
  const [maPushSubscription, setMaPushSubscription] = useState(
    pocatecni.maPushSubscription,
  );
  const [pristiDlouhodobaKontrola, setPristiDlouhodobaKontrola] = useState(
    pocatecni.pristiDlouhodobaKontrola ?? "",
  );
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [ulozeno, setUlozeno] = useState(false);
  const [pending, startTransition] = useTransition();

  function aplikujUi(stav: BranaUpozorneniNastaveniProUi) {
    setUpozorneniAktivni(stav.upozorneniAktivni);
    setMaPushSubscription(stav.maPushSubscription);
    setPristiDlouhodobaKontrola(stav.pristiDlouhodobaKontrola ?? "");
  }

  function zapnout() {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    setChyba(null);
    setUlozeno(false);

    startTransition(async () => {
      try {
        const subscription = await vytvoritBranaPushSubscription();
        const vysledek = await ulozitBranaPushSubscriptionAkce(subscription);
        if (!vysledek.uspech) {
          setChyba(vysledek.chyba);
          return;
        }
        aplikujUi(vysledek.ui);
        setUlozeno(true);
      } catch (error) {
        const zprava =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Upozornění se nepodařilo zapnout.";
        setChyba(zprava);
      }
    });
  }

  function vypnout() {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    setChyba(null);
    setUlozeno(false);

    startTransition(async () => {
      await odhlasitBranaPushSubscriptionVProhlizeci();
      const vysledek = await vypnoutBranaPushSubscriptionAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      aplikujUi(vysledek.ui);
      setUlozeno(true);
    });
  }

  function ulozitDatum() {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    setChyba(null);
    setUlozeno(false);

    startTransition(async () => {
      const vysledek = await ulozitBranaUpozorneniPristiKontroluAkce(
        pristiDlouhodobaKontrola.trim() ? pristiDlouhodobaKontrola.trim() : null,
      );
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      aplikujUi(vysledek.ui);
      setUlozeno(true);
    });
  }

  return (
    <div className="space-y-6" aria-label="Nastavení upozornění">
      <div className="space-y-2">
        <h3 className="text-sm font-normal text-text-jemny">
          Upozornění na tomto telefonu
        </h3>
        {maPushSubscription && upozorneniAktivni ? (
          <>
            <p className="text-sm text-text">
              Stav: <span className="text-text">AKTIVNÍ</span>
            </p>
            <button
              type="button"
              className="border border-text-velmiJemny/40 px-3 py-1.5 text-sm text-text disabled:opacity-50"
              disabled={!uloziteniPovoleno || pending}
              onClick={vypnout}
            >
              {pending ? "Ukládám…" : "Vypnout upozornění na tomto telefonu"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="border border-text-velmiJemny/40 px-3 py-1.5 text-sm text-text disabled:opacity-50"
            disabled={!uloziteniPovoleno || pending}
            onClick={zapnout}
          >
            {pending ? "Ukládám…" : "Zapnout upozornění na tomto telefonu"}
          </button>
        )}
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
        <p className="text-sm text-text">Každých 21 dní · pondělí · 9:00</p>
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
          onClick={ulozitDatum}
        >
          {pending ? "Ukládám…" : "Uložit datum"}
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
