"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function TrebonInformace() {
  const router = useRouter();
  const zavrit = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col bg-krem/95">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-8"
        style={{
          paddingTop: "calc(4.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="trebon-informace-text">
          <p>
            Třeboň po celý rok je pro všechny, kterým se po Třeboni občas
            zasteskne.
          </p>
          <p>
            Pro chvíle mezi návštěvami. Pro návraty ve vzpomínkách. Pro místa,
            na která se člověk rád vrací.
          </p>
          <p>Jen malé kousky Třeboně během celého roku.</p>
          <p>
            Analytika neukládá jména, e-mailové adresy, IP adresy ani přesné
            souřadnice. V prohlížeči používá jednoduché značky pro rozlišení
            návštěv a návratů. Souhrnné údaje se uchovávají nejvýše 400 dní.
          </p>
          <p>
            Vzkazy lze odesílat anonymně, bez uvedení kontaktních údajů.
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
        onClick={zavrit}
        className="trebon-informace-zavrit absolute right-6"
        aria-label="Zavřít"
      >
        ✕
      </button>
    </div>
  );
}
