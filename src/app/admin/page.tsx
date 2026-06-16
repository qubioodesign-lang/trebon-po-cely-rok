import { AdminPanel } from "@/components/AdminPanel";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAdminData } from "@/lib/admin-data";
import type { AdminData } from "@/types";

export const dynamic = "force-dynamic";

/** Stránka administrace – data se načítají na serveru (OIDC pro Blob) */
export default async function StrankaAdmin() {
  const prihlasen = await jeAdminPrihlasen();

  let data: AdminData | null = null;
  let chybaNacitani: string | null = null;

  if (prihlasen) {
    try {
      data = await nacistAdminData();
    } catch (error) {
      chybaNacitani =
        error instanceof Error
          ? error.message
          : "Nepodařilo se načíst data administrace";
    }
  }

  return (
    <AdminPanel
      jePrihlasen={prihlasen}
      data={data}
      chybaNacitani={chybaNacitani}
    />
  );
}
