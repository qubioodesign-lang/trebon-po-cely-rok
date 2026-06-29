import { AdminPanel } from "@/components/AdminPanel";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { nacistAdminData } from "@/lib/admin-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stránka administrace – data se načítají na serveru (OIDC pro Blob) */
export default async function StrankaAdmin() {
  const prihlasen = await jeAdminPrihlasen();

  if (!prihlasen) {
    return <AdminPanel jePrihlasen={false} data={null} chyby={{}} />;
  }

  const { data, chyby } = await nacistAdminData();

  return <AdminPanel jePrihlasen data={data} chyby={chyby} />;
}
