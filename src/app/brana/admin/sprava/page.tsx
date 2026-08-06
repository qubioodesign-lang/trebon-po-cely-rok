import { redirect } from "next/navigation";
import { branaAdminInterniCesta } from "@/lib/brana/admin";

/** Správa – výchozí přesměrování na Kalendář */
export default function StrankaBranaAdminSprava() {
  redirect(branaAdminInterniCesta("sprava", "kalendar"));
}
