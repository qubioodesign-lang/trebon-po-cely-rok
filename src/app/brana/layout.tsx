import type { Metadata, Viewport } from "next";
import {
  BRANA_NAZEV,
  BRANA_POPIS,
  BRANA_PWA_DEN_BARVA,
} from "@/lib/brana";
import "./brana.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trebonpocelyrok.cz"),
  title: {
    default: BRANA_NAZEV,
    template: `%s · ${BRANA_NAZEV}`,
  },
  description: BRANA_POPIS,
  manifest: "/brana/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Třeboň",
  },
  icons: {
    icon: "/brana/icon",
    apple: "/brana/apple-icon",
  },
  openGraph: {
    title: "BRÁNA do Třeboně",
    description: BRANA_POPIS,
    type: "website",
    locale: "cs_CZ",
    images: [
      {
        url: "/brana/apple-icon",
        width: 512,
        height: 512,
        alt: "BRÁNA do Třeboně",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "BRÁNA do Třeboně",
    description: BRANA_POPIS,
    images: ["/brana/apple-icon"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BRANA_PWA_DEN_BARVA,
};

export default function BranaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="brana-root">{children}</div>;
}
