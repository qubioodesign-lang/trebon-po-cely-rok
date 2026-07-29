import { BRANA_ADMIN_NAZEV } from "@/lib/brana/admin";

/** Vstupní obrazovka administrace Brány – kořen budoucího vývoje */
export function BranaAdminHlavni() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="brana-admin-hlavicka">
        <h1 className="brana-admin-nadpis">{BRANA_ADMIN_NAZEV.toLowerCase()}</h1>
      </header>
    </main>
  );
}
