import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminVzkazy } from "@/components/brana/admin/BranaAdminVzkazy";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { ziskatOidcZHlavicek } from "@/lib/env-blob";
import {
  nacistVsechnyBranaVzkazy,
  seraditBranaVzkazyOdNejnovejsich,
} from "@/lib/brana/vzkaz";

/** Správa → Vzkazy. Čtení až po přihlášení. */
export default async function StrankaBranaAdminVzkazy() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");
  let vzkazy: { id: string; text: string; vytvoreno: string }[] = [];
  let chyba: string | null = null;

  try {
    const oidc = await ziskatOidcZHlavicek();
    const nactene = await nacistVsechnyBranaVzkazy(oidc);
    vzkazy = seraditBranaVzkazyOdNejnovejsich(nactene).map((vzkaz) => ({
      id: vzkaz.id,
      text: vzkaz.text,
      vytvoreno: vzkaz.vytvoreno,
    }));
  } catch {
    chyba = "Vzkazy se nepodařilo načíst.";
  }

  return (
    <BranaAdminObal host={host} aktivniCast="sprava" aktivniSpravaSekce="vzkazy">
      <BranaAdminVzkazy vzkazy={vzkazy} chyba={chyba} />
    </BranaAdminObal>
  );
}
