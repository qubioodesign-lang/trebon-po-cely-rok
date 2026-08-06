import { redirect } from "next/navigation";
import { branaAdminInterniCesta } from "@/lib/brana/admin";
import { jeAdminPrihlasen } from "@/lib/autentizace";

/** Správa – výchozí přesměrování na Kalendář */
export default async function StrankaBranaAdminSprava() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  redirect(branaAdminInterniCesta("sprava", "kalendar"));
}
