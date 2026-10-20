"use client";

import { useEffect, useState } from "react";
import {
  nacistTrebonSpravceUpozorneniAkce,
  odeslatTrebonTestovaciUpozorneniAkce,
  ulozitTrebonSpravceSubscriptionAkce,
  vypnoutTrebonSpravceUpozorneniAkce,
} from "@/app/admin/spravce-upozorneni-actions";
import {
  odhlasitTrebonSpravcePushVProhlizeci,
  prihlasitTrebonSpravcePush,
} from "@/lib/trebon-spravce-upozorneni-klient";

export function AdminSpravceUpozorneni() {
  const [aktivni, setAktivni] = useState(false);
  const [nacitam, setNacitam] = useState(true);
  const [probiha, setProbiha] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [testOdeslan, setTestOdeslan] = useState(false);

  useEffect(() => {
    let zive = true;
    void nacistTrebonSpravceUpozorneniAkce().then((vysledek) => {
      if (!zive) return;
      if (vysledek.uspech) {
        setAktivni(vysledek.ui.upozorneniAktivni);
      } else {
        setChyba(vysledek.chyba);
      }
      setNacitam(false);
    });
    return () => {
      zive = false;
    };
  }, []);

  async function zapnout() {
    setProbiha(true);
    setChyba(null);
    setTestOdeslan(false);
    try {
      const subscription = await prihlasitTrebonSpravcePush();
      const vysledek = await ulozitTrebonSpravceSubscriptionAkce(subscription);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setAktivni(vysledek.ui.upozorneniAktivni);
    } catch (error) {
      setChyba(
        error instanceof Error
          ? error.message
          : "Upozornění se nepodařilo zapnout.",
      );
    } finally {
      setProbiha(false);
    }
  }

  async function vypnout() {
    setProbiha(true);
    setChyba(null);
    setTestOdeslan(false);
    try {
      await odhlasitTrebonSpravcePushVProhlizeci();
      const vysledek = await vypnoutTrebonSpravceUpozorneniAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setAktivni(vysledek.ui.upozorneniAktivni);
    } catch (error) {
      setChyba(
        error instanceof Error
          ? error.message
          : "Upozornění se nepodařilo vypnout.",
      );
    } finally {
      setProbiha(false);
    }
  }

  async function poslatTest() {
    setProbiha(true);
    setChyba(null);
    setTestOdeslan(false);
    try {
      const vysledek = await odeslatTrebonTestovaciUpozorneniAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setTestOdeslan(true);
    } catch (error) {
      setChyba(
        error instanceof Error
          ? error.message
          : "Testovací upozornění se nepodařilo odeslat.",
      );
    } finally {
      setProbiha(false);
    }
  }

  return (
    <section className="space-y-3 border border-text-velmiJemny/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-light text-text-jemny">
          upozornění na vzkaz
        </h2>
        <span className="text-xs font-light tracking-wide text-text-velmiJemny">
          {nacitam ? "…" : aktivni ? "AKTIVNÍ" : "VYPNUTO"}
        </span>
      </div>
      <p className="text-xs font-light leading-relaxed text-text-velmiJemny">
        Jen na tomto telefonu. Návštěvníci galerie se neptají na oznámení.
      </p>
      {aktivni ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void vypnout()}
            disabled={probiha || nacitam}
            className="border border-text-velmiJemny/40 px-3 py-2 text-xs font-light tracking-wide text-text-jemny disabled:opacity-40"
          >
            Vypnout upozornění na tomto telefonu
          </button>
          <button
            type="button"
            onClick={() => void poslatTest()}
            disabled={probiha || nacitam}
            className="border border-text-velmiJemny/40 px-3 py-2 text-xs font-light tracking-wide text-text-jemny disabled:opacity-40"
          >
            Poslat testovací upozornění
          </button>
          {testOdeslan ? (
            <p className="w-full text-xs font-light text-text-velmiJemny" role="status">
              Testovací upozornění odesláno.
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void zapnout()}
          disabled={probiha || nacitam}
          className="border border-text-velmiJemny/40 px-3 py-2 text-xs font-light tracking-wide text-text-jemny disabled:opacity-40"
        >
          Zapnout upozornění na tomto telefonu
        </button>
      )}
      {chyba ? (
        <p className="text-xs font-light text-red-800/80">{chyba}</p>
      ) : null}
    </section>
  );
}
