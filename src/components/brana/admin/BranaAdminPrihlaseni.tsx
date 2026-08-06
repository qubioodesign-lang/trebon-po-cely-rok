"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prihlasitAdmin } from "@/app/admin/actions";
import { BRANA_ADMIN_NAZEV } from "@/lib/brana/admin";

/**
 * Přihlášení do administrace BRÁNY.
 * Používá stejnou serverovou akci a session cookie jako administrace Třeboně.
 */
export function BranaAdminPrihlaseni() {
  const router = useRouter();
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState("");
  const [probiha, setProbiha] = useState(false);

  const handlePrihlaseni = async (e: React.FormEvent) => {
    e.preventDefault();
    setChyba("");
    setProbiha(true);

    try {
      const vysledek = await prihlasitAdmin(heslo);
      if ("uspech" in vysledek && vysledek.uspech) {
        setHeslo("");
        router.refresh();
        return;
      }
      setChyba(vysledek.chyba ?? "Neplatné heslo");
    } finally {
      setProbiha(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <form onSubmit={handlePrihlaseni} className="w-full max-w-xs space-y-4">
        <h1 className="text-center text-lg font-light text-text">
          {BRANA_ADMIN_NAZEV.toLowerCase()}
        </h1>
        <input
          type="password"
          value={heslo}
          onChange={(e) => setHeslo(e.target.value)}
          placeholder="heslo"
          autoComplete="current-password"
          disabled={probiha}
          className="w-full border border-text-velmiJemny/30 bg-transparent px-4 py-2 text-sm text-text outline-none focus:border-text-jemny/50"
        />
        {chyba ? (
          <p className="text-center text-xs text-red-400">{chyba}</p>
        ) : null}
        <button
          type="submit"
          disabled={probiha}
          className="tlacitko-klidne w-full"
        >
          přihlásit se
        </button>
      </form>
    </div>
  );
}
