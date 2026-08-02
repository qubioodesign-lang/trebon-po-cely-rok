import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BranaCestyProvider } from "@/components/brana/BranaCestyProvider";
import {
  BRANA_IKONA_LAUNCHER_URL,
  BRANA_NAZEV,
  BRANA_POPIS,
  BRANA_PWA_DEN_BARVA,
} from "@/lib/brana";
import "./brana.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trebonpocelyrok.cz"),
  title: {
    default: "Třeboň",
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
    icon: [
      {
        url: BRANA_IKONA_LAUNCHER_URL,
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: BRANA_IKONA_LAUNCHER_URL,
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

export default async function BranaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host");

  return (
    <div className="brana-root">
      {/* synchronní skript – musí běžet dříve než beforeinstallprompt */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/brana/pwa-instalace-vcasna.js" />
      <BranaCestyProvider host={host}>{children}</BranaCestyProvider>
    </div>
  );
}
