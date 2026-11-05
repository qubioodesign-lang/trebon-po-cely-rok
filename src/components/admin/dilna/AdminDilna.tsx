"use client";

import { useEffect, useRef, useState } from "react";
import {
  DILNA_POSUN_MAX,
  DILNA_POSUN_MIN,
} from "./dilna-konstanty";
import { vykreslitDilnu } from "./dilna-platno";

function jeJpeg(soubor: File): boolean {
  const typ = soubor.type.toLowerCase();
  if (typ === "image/jpeg" || typ === "image/jpg" || typ === "image/pjpeg") {
    return true;
  }
  return /\.jpe?g$/i.test(soubor.name);
}

function cssRodina(seznam: string): string {
  const kus =
    seznam.split(",")[0]?.trim().replace(/^["']|["']$/g, "") || "sans-serif";
  return `"${kus}"`;
}

/**
 * Místní příprava fotografie s textem.
 * Nepřijímá data galerie a nikam je neposílá.
 */
export function AdminDilna() {
  const sondaPisma = useRef<HTMLSpanElement>(null);
  const vstupSouboru = useRef<HTMLInputElement>(null);
  const beh = useRef(0);
  const nahledRef = useRef<string | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const [rodina, setRodina] = useState<string | null>(null);
  const [bitmapa, setBitmapa] = useState<ImageBitmap | null>(null);
  const [text, setText] = useState("");
  const [posun, setPosun] = useState(0);
  const [nahled, setNahled] = useState<string | null>(null);
  const [nevejde, setNevejde] = useState(false);
  const [kresli, setKresli] = useState(false);
  const [chyba, setChyba] = useState("");

  useEffect(() => {
    const prvek = sondaPisma.current;
    if (!prvek) return;
    const family = cssRodina(getComputedStyle(prvek).fontFamily);
    let zruseno = false;
    void document.fonts
      .load(`300 14px ${family}`)
      .then(() => {
        if (!zruseno) setRodina(family);
      })
      .catch(() => {
        if (!zruseno) setRodina(family);
      });
    return () => {
      zruseno = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      if (nahledRef.current) URL.revokeObjectURL(nahledRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bitmapa || !rodina) return;
    const tento = ++beh.current;
    let zruseno = false;
    setKresli(true);
    void vykreslitDilnu(bitmapa, text, posun, rodina)
      .then((vysledek) => {
        if (zruseno || tento !== beh.current) return;
        const url = URL.createObjectURL(vysledek.blob);
        if (nahledRef.current) URL.revokeObjectURL(nahledRef.current);
        nahledRef.current = url;
        setNahled(url);
        setNevejde(vysledek.nevejdeSe);
        setKresli(false);
      })
      .catch(() => {
        if (zruseno || tento !== beh.current) return;
        setChyba("Náhled se nepodařilo vytvořit.");
        setKresli(false);
      });
    return () => {
      zruseno = true;
    };
  }, [bitmapa, text, posun, rodina]);

  const vybratSoubor = async (soubor: File | null) => {
    setChyba("");
    if (!soubor) return;
    if (!jeJpeg(soubor)) {
      setChyba("Vyberte fotografii JPG.");
      if (vstupSouboru.current) vstupSouboru.current.value = "";
      return;
    }

    try {
      const nova = await createImageBitmap(soubor);
      const predchozi = bitmapRef.current;
      bitmapRef.current = nova;
      setBitmapa(nova);
      if (predchozi) {
        window.setTimeout(() => predchozi.close(), 2000);
      }
    } catch {
      setChyba("Soubor se nepodařilo načíst. Vyberte JPG.");
    } finally {
      if (vstupSouboru.current) vstupSouboru.current.value = "";
    }
  };

  const stahnout = () => {
    if (!nahled) return;
    const odkaz = document.createElement("a");
    odkaz.href = nahled;
    odkaz.download = "trebon-dilna.png";
    odkaz.click();
  };

  return (
    <section className="relative space-y-4 border border-text-velmiJemny/20 p-4">
      <span
        ref={sondaPisma}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0 font-sans text-sm font-light"
        aria-hidden="true"
      >
        ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ
      </span>

      <h2 className="text-sm font-light text-text-jemny">Dílna</h2>
      <p className="text-xs font-light text-text-velmiJemny">
        Fotografie a text zůstávají v tomto prohlížeči. Nic se neukládá.
      </p>

      <label className="block space-y-1 text-xs text-text-velmiJemny">
        fotografie JPG
        <input
          ref={vstupSouboru}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          className="mt-1 w-full text-xs text-text-jemny"
          onChange={(e) => {
            const soubor = e.target.files?.[0] ?? null;
            void vybratSoubor(soubor);
          }}
        />
      </label>

      <label className="block space-y-1 text-xs text-text-velmiJemny">
        text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="text na fotografii"
          className="mt-1 w-full resize-y border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none whitespace-pre"
        />
      </label>

      <label className="block space-y-2 text-xs text-text-velmiJemny">
        svislá poloha
        <input
          type="range"
          min={DILNA_POSUN_MIN}
          max={DILNA_POSUN_MAX}
          step={1}
          value={posun}
          aria-label="Svislá poloha textu"
          onChange={(e) => setPosun(Number(e.target.value))}
          className="w-full accent-text"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setPosun(0)}
          className="text-xs text-text"
        >
          Vrátit na střed
        </button>
        <button
          type="button"
          onClick={stahnout}
          disabled={!nahled || kresli}
          className="tlacitko-klidne disabled:opacity-30"
        >
          Stáhnout PNG
        </button>
      </div>

      {chyba ? <p className="text-xs text-red-400">{chyba}</p> : null}
      {nevejde ? (
        <p className="text-xs text-amber-700/80">
          Text se do fotografie nevejde. Zkraťte ho. Velikost písma zůstává.
        </p>
      ) : null}
      {kresli && bitmapa ? (
        <p className="text-xs text-text-velmiJemny">připravuji náhled…</p>
      ) : null}

      {nahled ? (
        // Náhled je přímo výsledný PNG, ne samostatná CSS kresba.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nahled}
          alt="Náhled výsledné fotografie"
          className="mx-auto h-auto w-full max-w-[320px]"
        />
      ) : null}
    </section>
  );
}
