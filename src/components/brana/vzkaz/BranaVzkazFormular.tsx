"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { BRANA_MAX_DELKA_VZKAZU } from "@/lib/brana/vzkaz/konstanty";
import {
  BranaVzkazPotvrzeniListek,
  TRIDA_BRANA_VZKAZ_LISTEK,
} from "./BranaVzkazPotvrzeniListek";

const HLASKA_CHYBY =
  "Vzkaz možná nedoputoval. Zkuste to prosím ještě jednou.";

type StavFormulare = "psani" | "odesilani" | "uspech";

export function BranaVzkazFormular() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [stav, setStav] = useState<StavFormulare>("psani");
  const [chybovaZprava, setChybovaZprava] = useState<string | null>(null);
  const [odsazeniDole, setOdsazeniDole] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const odesilaRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
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
  }, []);

  const zavritStranku = useCallback(() => {
    router.push("/brana");
  }, [router]);

  const handleOdeslat = async (event: FormEvent) => {
    event.preventDefault();

    const vycisteny = text.trim();
    if (
      !vycisteny ||
      odesilaRef.current ||
      stav === "odesilani" ||
      stav === "uspech"
    ) {
      return;
    }

    odesilaRef.current = true;
    setChybovaZprava(null);
    setStav("odesilani");

    try {
      const odpoved = await fetch("/api/brana/vzkaz", {
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

  return (
    <div
      className="brana-vzkaz-stranka relative mx-auto flex h-dvh w-full max-w-md flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brana-vzkaz-nadpis"
    >
      <div
        className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 transition-[padding] duration-150"
        style={{ paddingBottom: `calc(2rem + ${odsazeniDole}px)` }}
      >
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          {stav === "uspech" ? (
            <BranaVzkazPotvrzeniListek onDokonceno={zavritStranku} />
          ) : (
            <>
              <h1
                id="brana-vzkaz-nadpis"
                className="brana-vzkaz-nadpis mb-8 text-sm font-light tracking-wide"
              >
                Nechte vzkaz BRÁNĚ
              </h1>

              <form
                onSubmit={(event) => void handleOdeslat(event)}
                className="flex w-full flex-col items-center"
              >
                <div
                  onClick={handleKlikListek}
                  className={TRIDA_BRANA_VZKAZ_LISTEK}
                >
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => {
                      setText(
                        event.target.value.slice(0, BRANA_MAX_DELKA_VZKAZU),
                      );
                    }}
                    rows={6}
                    disabled={stav === "odesilani"}
                    aria-label="Vzkaz BRÁNĚ"
                    className="vzkaz-listek w-full resize-none border-0 bg-transparent p-0 text-xl leading-relaxed outline-none focus:ring-0 disabled:opacity-60"
                    style={{ minHeight: "9rem" }}
                  />
                </div>

                <p className="brana-vzkaz-pocitadlo mt-4 text-xs tabular-nums">
                  {text.length} / {BRANA_MAX_DELKA_VZKAZU}
                </p>

                {chybovaZprava && (
                  <p
                    className="brana-vzkaz-chyba mt-4 max-w-xs text-center text-xs"
                    role="alert"
                  >
                    {chybovaZprava}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!text.trim() || stav === "odesilani"}
                  className="tlacitko-klidne brana-vzkaz-tlacitko mt-8 disabled:opacity-40"
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
          onClick={zavritStranku}
          className="brana-vzkaz-zavrit absolute right-6 top-8"
          aria-label="Zavřít"
        >
          ✕
        </button>
      )}
    </div>
  );
}
