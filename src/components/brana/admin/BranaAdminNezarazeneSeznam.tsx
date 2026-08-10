"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { smazatBranaNezarazenyNalezAkce } from "@/app/brana/admin/actions";
import { BranaAdminAkcePolozka } from "@/components/brana/admin/BranaAdminAkcePolozka";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import {
  formatujUdajVpravoNezarazene,
  type BranaNezarazenyNalez,
} from "@/lib/brana/admin/nezarazene";

type Props = {
  pocatecniOtevrene: BranaNezarazenyNalez[];
};

export function BranaAdminNezarazeneSeznam({ pocatecniOtevrene }: Props) {
  const router = useRouter();
  const [otevrene, setOtevrene] = useState(pocatecniOtevrene);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function smazat(nalez: BranaNezarazenyNalez) {
    const popisek = nalez.nazev.trim() || nalez.mistoNeboTyp.trim();
    if (
      !window.confirm(
        `Smazat nezařazený nález „${popisek}“? Stejný konkrétní nález se při scanu znovu neobjeví.`,
      )
    ) {
      return;
    }
    setChyba(null);
    setPendingId(nalez.id);
    startTransition(async () => {
      const vysledek = await smazatBranaNezarazenyNalezAkce(nalez.id);
      setPendingId(null);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setOtevrene((pred) => pred.filter((n) => n.id !== nalez.id));
      router.refresh();
    });
  }

  if (otevrene.length === 0) {
    return (
      <p className="text-sm text-text-jemny">Žádné otevřené nezařazené nálezy.</p>
    );
  }

  return (
    <div className="space-y-3">
      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      <ul className="brana-admin-seznam-akci">
        {otevrene.map((nalez) => {
          const { typ, misto, nazev } = rozlozAkci({
            mistoNeboTyp: nalez.mistoNeboTyp,
            nazev: nalez.nazev,
            cas: nalez.cas,
          });
          return (
            <BranaAdminAkcePolozka
              key={nalez.id}
              typ={typ}
              misto={misto}
              nazev={nazev}
              udajVpravo={formatujUdajVpravoNezarazene(nalez)}
              chrome={
                <div className="mt-0.5 flex flex-wrap items-center gap-3">
                  {nalez.zdrojNazev ? (
                    <span className="text-xs font-light text-text-jemny">
                      {nalez.zdrojNazev}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => smazat(nalez)}
                    disabled={pending && pendingId === nalez.id}
                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {pending && pendingId === nalez.id ? "Mažu…" : "Smazat"}
                  </button>
                </div>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
