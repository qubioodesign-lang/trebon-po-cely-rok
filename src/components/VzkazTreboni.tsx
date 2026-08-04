"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ODKLAD_OBALKY_MS,
  VZKAZ_HISTORIE_CESTA,
  VZKAZ_HISTORIE_STAV,
  existujeVzkazHistorieZaznam,
  jeVzkazHistorieStav,
  jeVzkazHistorieUrl,
  maZobrazitObalkuVzkazu,
  obalkaUzBylaZobrazenaVRelaci,
  oznacitObalkuJakoZobrazenou,
} from "@/lib/vzkaz-treboni-navstevnik";
import {
  TRIDA_VZKAZ_LISTEK,
  VzkazPotvrzeniListek,
} from "./VzkazPotvrzeniListek";

const MAX_DELKA = 200;

const HLASKA_CHYBY =
  "Vzkaz možná nedoputoval. Zkuste to prosím ještě jednou.";

type StavModalu = "psani" | "odesilani" | "uspech";

function IkonaObalky() {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1 3.5 11 10l10-6.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="1"
        y="2"
        width="20"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function vycistitVzkazUrl(): void {
  if (!jeVzkazHistorieUrl()) {
    return;
  }

  window.history.replaceState(window.history.state, "", "/");
}

/**
 * Obálka pro vracející se návštěvníky a psaní vzkazu Třeboni.
 * Bez animací – tiše se objeví po 15 s od otevření webu.
 * Modal má vlastní history entry (/?vzkaz), aby systémové Zpět nevypínalo PWA.
 */
export function VzkazTreboni() {
  const [zobrazitObalku, setZobrazitObalku] = useState(false);
  const [modalOtevren, setModalOtevren] = useState(false);
  const [text, setText] = useState("");
  const [stav, setStav] = useState<StavModalu>("psani");
  const [chybovaZprava, setChybovaZprava] = useState<string | null>(null);
  const [odsazeniDole, setOdsazeniDole] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const odesilaRef = useRef(false);
  const modalOtevrenRef = useRef(false);
  /** True, pokud tato instance přidala (nebo vlastní) history entry modalu. */
  const historieVlozenaRef = useRef(false);

  const resetModalnihoStavu = useCallback(() => {
    odesilaRef.current = false;
    setModalOtevren(false);
    setStav("psani");
    setText("");
    setChybovaZprava(null);
    setOdsazeniDole(0);
  }, []);

  useEffect(() => {
    modalOtevrenRef.current = modalOtevren;
  }, [modalOtevren]);

  useEffect(() => {
    if (obalkaUzBylaZobrazenaVRelaci()) {
      setZobrazitObalku(true);
      return;
    }

    if (!maZobrazitObalkuVzkazu()) {
      return;
    }

    const casovac = window.setTimeout(() => {
      setZobrazitObalku(true);
      oznacitObalkuJakoZobrazenou();
    }, ODKLAD_OBALKY_MS);

    return () => window.clearTimeout(casovac);
  }, []);

  // Přímé otevření /?vzkaz bez našeho pushState → galerie, čistá URL.
  useEffect(() => {
    if (!jeVzkazHistorieUrl()) {
      return;
    }

    if (jeVzkazHistorieStav(window.history.state)) {
      return;
    }

    vycistitVzkazUrl();
  }, []);

  useEffect(() => {
    const priPopState = () => {
      if (!modalOtevrenRef.current && !historieVlozenaRef.current) {
        if (jeVzkazHistorieUrl() && !jeVzkazHistorieStav(window.history.state)) {
          vycistitVzkazUrl();
        }
        return;
      }

      historieVlozenaRef.current = false;
      resetModalnihoStavu();

      if (jeVzkazHistorieUrl() && !jeVzkazHistorieStav(window.history.state)) {
        vycistitVzkazUrl();
      }
    };

    window.addEventListener("popstate", priPopState);
    return () => window.removeEventListener("popstate", priPopState);
  }, [resetModalnihoStavu]);

  useEffect(() => {
    if (!modalOtevren || typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const upravitOdsazeni = () => {
      const rozdil = window.innerHeight - viewport.height - viewport.offsetTop;
      setOdsazeniDole(Math.max(0, rozdil));
    };

    upravitOdsazeni();
    viewport.addEventListener("resize", upravitOdsazeni);
    viewport.addEventListener("scroll", upravitOdsazeni);

    return () => {
      viewport.removeEventListener("resize", upravitOdsazeni);
      viewport.removeEventListener("scroll", upravitOdsazeni);
    };
  }, [modalOtevren]);

  const otevritModal = useCallback(() => {
    if (modalOtevrenRef.current) {
      return;
    }

    setModalOtevren(true);

    // Už máme právě jeden modalový záznam – další pushState nepřidávej.
    if (historieVlozenaRef.current || existujeVzkazHistorieZaznam()) {
      historieVlozenaRef.current = true;
      return;
    }

    // Orfaní ?vzkaz bez state: nejdřív srovnej na /, pak jeden push.
    if (jeVzkazHistorieUrl()) {
      window.history.replaceState(null, "", "/");
    }

    window.history.pushState(VZKAZ_HISTORIE_STAV, "", VZKAZ_HISTORIE_CESTA);
    historieVlozenaRef.current = true;
  }, []);

  const zavritModal = useCallback(() => {
    if (historieVlozenaRef.current || existujeVzkazHistorieZaznam()) {
      window.history.back();
      return;
    }

    resetModalnihoStavu();
    vycistitVzkazUrl();
  }, [resetModalnihoStavu]);

  const handleOdeslat = async (event: FormEvent) => {
    event.preventDefault();

    const vycisteny = text.trim();
    if (!vycisteny || odesilaRef.current || stav === "odesilani" || stav === "uspech") {
      return;
    }

    odesilaRef.current = true;
    setChybovaZprava(null);
    setStav("odesilani");

    try {
      const odpoved = await fetch("/api/vzkaz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: vycisteny }),
      });

      let telo: { uspech?: boolean } | null = null;
      try {
        telo = (await odpoved.json()) as { uspech?: boolean };
      } catch {
        telo = null;
      }

      if (!odpoved.ok || telo?.uspech !== true) {
        setChybovaZprava(HLASKA_CHYBY);
        setStav("psani");
        odesilaRef.current = false;
        return;
      }

      textareaRef.current?.blur();
      setStav("uspech");
    } catch {
      setChybovaZprava(HLASKA_CHYBY);
      setStav("psani");
      odesilaRef.current = false;
    }
  };

  const handleKlikListek = () => {
    if (stav !== "psani") {
      return;
    }

    textareaRef.current?.focus();
  };

  if (!zobrazitObalku && !modalOtevren) {
    return null;
  }

  return (
    <>
      {zobrazitObalku && !modalOtevren && (
        <button
          type="button"
          onClick={otevritModal}
          className="fixed z-[25] text-white/70 transition-colors duration-300 hover:text-white/95 focus-visible:text-white/95 focus-visible:outline-none"
          style={{
            right: "0.5rem",
            bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
          }}
          aria-label="Nechte vzkaz Třeboni"
        >
          <IkonaObalky />
        </button>
      )}

      {modalOtevren && (
        <div
          className="fixed inset-0 z-[50] flex min-h-dvh flex-col bg-krem/95"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vzkaz-treboni-nadpis"
        >
          <div
            className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 transition-[padding] duration-150"
            style={{ paddingBottom: `calc(2rem + ${odsazeniDole}px)` }}
          >
            <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center">
              {stav === "uspech" ? (
                <VzkazPotvrzeniListek onDokonceno={zavritModal} />
              ) : (
                <>
                  <h2
                    id="vzkaz-treboni-nadpis"
                    className="mb-8 text-sm font-light tracking-wide text-text-jemny"
                  >
                    Nechte vzkaz Třeboni
                  </h2>

                  <form
                    onSubmit={(event) => void handleOdeslat(event)}
                    className="flex w-full flex-col items-center"
                  >
                    <div
                      onClick={handleKlikListek}
                      className={TRIDA_VZKAZ_LISTEK}
                    >
                      <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(event) => {
                          setText(event.target.value.slice(0, MAX_DELKA));
                        }}
                        rows={6}
                        disabled={stav === "odesilani"}
                        aria-label="Vzkaz Třeboni"
                        className="vzkaz-listek w-full resize-none border-0 bg-transparent p-0 text-xl leading-relaxed outline-none focus:ring-0 disabled:opacity-60"
                        style={{ minHeight: "9rem" }}
                      />
                    </div>

                    <p className="mt-4 text-xs tabular-nums text-text-velmiJemny">
                      {text.length} / {MAX_DELKA}
                    </p>

                    {chybovaZprava && (
                      <p
                        className="mt-4 max-w-xs text-center text-xs text-text-jemny"
                        role="alert"
                      >
                        {chybovaZprava}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!text.trim() || stav === "odesilani"}
                      className="tlacitko-klidne mt-8 disabled:opacity-40"
                    >
                      {stav === "odesilani" ? "Odesílám…" : "Odeslat vzkaz"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {stav === "psani" && (
            <button
              type="button"
              onClick={zavritModal}
              className="odkaz-jemny absolute right-6 top-8"
              aria-label="Zavřít"
            >
              zavřít
            </button>
          )}
        </div>
      )}
    </>
  );
}
