import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { BranaAdminZalohy } from "@/components/brana/admin/BranaAdminZalohy";
import { seznamBranaZaloh } from "@/lib/brana/admin/zaloha";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa → Záloha – ruční zálohy BRÁNY v PRIVATE store */
export default async function StrankaBranaAdminZaloha() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

  let pocatecniZalohy: Awaited<ReturnType<typeof seznamBranaZaloh>> = [];
  let pocatecniChyba: string | null = null;

  try {
    pocatecniZalohy = await seznamBranaZaloh();
  } catch (error) {
    pocatecniChyba =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Seznam záloh se nepodařilo načíst.";
  }

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="zaloha"
    >
      <BranaAdminZalohy
        pocatecniZalohy={pocatecniZalohy}
        pocatecniChyba={pocatecniChyba}
      />
    </BranaAdminObal>
  );
}
