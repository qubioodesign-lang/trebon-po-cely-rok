"use client";

import { useEffect } from "react";
import type { KategorieOdchoduNavstevy } from "@/types";
import { inicializovatSledovaniChovani } from "@/lib/chovani-navstevnika";

/** Inicializuje sledování zóny odchodu pro aktuální stránku */
export function useChovaniNavstevnika(zona: KategorieOdchoduNavstevy) {
  useEffect(() => {
    inicializovatSledovaniChovani(zona);
  }, [zona]);
}
