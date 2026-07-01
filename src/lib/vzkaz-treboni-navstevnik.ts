/** Návštěvník už někdy otevřel web (localStorage) */
export const KLIC_BYLA_NA_WEBU = "trebon_byla_na_webu";

/** První relace prohlížeče – obálka se nezobrazí ani po refreshi */
export const KLIC_PRVNI_RELACE = "trebon_prvni_relace";

/** Obálka už byla v této relaci zobrazena */
export const KLIC_VZKAZ_OBALKA_ZOBRAZENA = "trebon_vzkaz_obalka_zobrazena";

export const ODKLAD_OBALKY_MS = 15_000;

/** Vrátí true, pokud jde o druhou a další relaci (ne první návštěvu webu) */
export function maZobrazitObalkuVzkazu(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!localStorage.getItem(KLIC_BYLA_NA_WEBU)) {
    localStorage.setItem(KLIC_BYLA_NA_WEBU, "1");
    sessionStorage.setItem(KLIC_PRVNI_RELACE, "1");
    return false;
  }

  if (sessionStorage.getItem(KLIC_PRVNI_RELACE) === "1") {
    return false;
  }

  return true;
}

export function obalkaUzBylaZobrazenaVRelaci(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(KLIC_VZKAZ_OBALKA_ZOBRAZENA) === "1";
}

export function oznacitObalkuJakoZobrazenou(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(KLIC_VZKAZ_OBALKA_ZOBRAZENA, "1");
}
