import type { Metadata } from "next";
import { BRANA_ADMIN_NAZEV } from "@/lib/brana/admin";

export const metadata: Metadata = {
  title: "Administrace",
  description: BRANA_ADMIN_NAZEV,
  robots: {
    index: false,
    follow: false,
  },
};

export default function BranaAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="brana-admin-root flex min-h-dvh flex-1 flex-col">
      {children}
    </div>
  );
}
