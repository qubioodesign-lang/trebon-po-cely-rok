import type { Metadata, Viewport } from "next";
import { BRANA_NAZEV, BRANA_POPIS } from "@/lib/brana";
import "./brana.css";

export const metadata: Metadata = {
  title: {
    default: BRANA_NAZEV,
    template: `%s · ${BRANA_NAZEV}`,
  },
  description: BRANA_POPIS,
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF8F5",
};

export default function BranaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="brana-root">{children}</div>;
}
