/**
 * Stáří asistovaných zdrojů z `vytvoreno` mezidokumentů.
 * Žádný Blob. Společné stáří = nejstarší datum.
 */

import { okamzikVPraze, type BranaDatum } from "@/lib/brana/cas";
import { dnesIsoVPraze } from "@/lib/brana/admin/konkretni-udalost";
import jktItrebonMezidokument from "./divadlo-jk-tyla-itrebon.json";

const JKT_VYTVORENO =
  typeof jktItrebonMezidokument.vytvoreno === "string"
    ? jktItrebonMezidokument.vytvoreno
    : "";

/** Pořadí mezidokumentů – další zdroj = další `vytvoreno`. */
const ASISTOVANE_VYTVORENO: readonly string[] = [JKT_VYTVORENO];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatujIsoDen(datum: BranaDatum): string {
  return `${datum.rok}-${pad2(datum.mesic)}-${pad2(datum.den)}`;
}

function isoDenZVytvoreno(vytvoreno: string): string | null {
  const trim = vytvoreno.trim();
  if (trim.length === 0) {
    return null;
  }
  const okamzik = new Date(trim);
  if (Number.isNaN(okamzik.getTime())) {
    return null;
  }
  return formatujIsoDen(okamzikVPraze(okamzik));
}

function pocetKalendarnichDni(odIso: string, doIso: string): number {
  const od = Date.parse(`${odIso}T12:00:00Z`);
  const doDne = Date.parse(`${doIso}T12:00:00Z`);
  if (!Number.isFinite(od) || !Number.isFinite(doDne)) {
    return 0;
  }
  return Math.round((doDne - od) / 86_400_000);
}

export function textStariAsistovanychZdrojuZVytvoreno(
  vytvorenoSeznam: readonly string[],
  okamzik: Date = new Date(),
): string | null {
  const dny = vytvorenoSeznam
    .map(isoDenZVytvoreno)
    .filter((iso): iso is string => iso !== null)
    .sort();
  if (dny.length === 0) {
    return null;
  }
  const nejstarsi = dny[0];
  const stari = pocetKalendarnichDni(nejstarsi, dnesIsoVPraze(okamzik));
  const dnu = stari < 0 ? 0 : stari;
  if (dnu === 0) {
    return "Asistované zdroje aktualizovány dnes";
  }
  if (dnu === 1) {
    return "Asistované zdroje aktualizovány před 1 dnem";
  }
  return `Asistované zdroje aktualizovány před ${dnu} dny`;
}

export function textStariAsistovanychZdroju(
  okamzik: Date = new Date(),
): string | null {
  return textStariAsistovanychZdrojuZVytvoreno(ASISTOVANE_VYTVORENO, okamzik);
}
