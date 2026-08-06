import { redirect } from "next/navigation";
import { branaAdminInterniCesta } from "@/lib/brana/admin";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Kořen administrace BRÁNY – přesměrování na výchozí sekci Správy (Kalendář) */
export default async function StrankaBranaAdmin() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  redirect(branaAdminInterniCesta("sprava", "kalendar"));
}
