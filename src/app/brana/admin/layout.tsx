import type { Metadata } from "next";
import { BranaAdminPrihlaseni } from "@/components/brana/admin/BranaAdminPrihlaseni";
import { BRANA_ADMIN_NAZEV } from "@/lib/brana/admin";
import { jeAdminPrihlasen } from "@/lib/autentizace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace",
  description: BRANA_ADMIN_NAZEV,
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Layout administrace BRÁNY.
 * Chrání /brana/admin a všechny vnořené routy stejným session mechanismem
 * jako administrace Třeboně (jeAdminPrihlasen / admin_session).
 */
export default async function BranaAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const prihlasen = await jeAdminPrihlasen();

  return (
    <div className="brana-admin-root flex min-h-dvh flex-1 flex-col">
      {prihlasen ? children : <BranaAdminPrihlaseni />}
    </div>
  );
}
