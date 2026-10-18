"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useBranaVerejnaCesta } from "@/lib/brana/use-brana-cesty";

export function BranaInformace() {
  const router = useRouter();
  const branaDomov = useBranaVerejnaCesta("dnes");

  const zavritStranku = useCallback(() => {
    router.push(branaDomov);
  }, [router, branaDomov]);

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-8"
        style={{
          paddingTop: "calc(4.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="brana-informace-text">
          <h1>BRÁNA do Třeboně</h1>
          <p>
            BRÁNA přináší výběr událostí a informací z Třeboně a okolí.
          </p>
          <p>
            Informace vycházejí z veřejně dostupných zdrojů. Přestože jsou
            průběžně aktualizovány, mohou obsahovat nepřesnosti nebo se
            změnit bez předchozího upozornění.
          </p>
          <p>
            Za aktuálnost termínů, programů, podmínek účasti a případné
            změny či zrušení událostí odpovídají jejich pořadatelé. Před
            návštěvou doporučujeme ověřit podrobnosti přímo u pořadatele.
          </p>
          <h2>Kontakt</h2>
          <p>
            <a href="mailto:trebonpocelyrok@gmail.com">
              trebonpocelyrok@gmail.com
            </a>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={zavritStranku}
        className="brana-vzkaz-zavrit absolute right-6 top-8"
        aria-label="Zavřít"
      >
        ✕
      </button>
    </div>
  );
}
