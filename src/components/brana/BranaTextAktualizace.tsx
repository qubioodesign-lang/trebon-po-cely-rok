"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  dalsiZmenaAktualizaceVPraze,
  textAktualizaceVPraze,
} from "@/lib/brana/aktualizace";

const BranaAktualizaceContext = createContext<string | null>(null);

type BranaAktualizaceProviderProps = {
  children: ReactNode;
};

/** Sdílený stav textu aktualizace s automatickým přepnutím v 6:00 a 15:30. */
export function BranaAktualizaceProvider({
  children,
}: BranaAktualizaceProviderProps) {
  const [text, setText] = useState(() => textAktualizaceVPraze());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const obnov = useCallback(() => {
    setText(textAktualizaceVPraze());
  }, []);

  useEffect(() => {
    const naplanuj = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const dalsi = dalsiZmenaAktualizaceVPraze();
      const ms = Math.max(dalsi.getTime() - Date.now(), 0);

      timeoutRef.current = setTimeout(() => {
        obnov();
        naplanuj();
      }, ms);
    };

    naplanuj();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [obnov, text]);

  return (
    <BranaAktualizaceContext.Provider value={text}>
      {children}
    </BranaAktualizaceContext.Provider>
  );
}

export function BranaTextAktualizace() {
  const text = useContext(BranaAktualizaceContext);

  if (text === null) {
    throw new Error(
      "BranaTextAktualizace musí být uvnitř BranaAktualizaceProvider.",
    );
  }

  return text;
}
