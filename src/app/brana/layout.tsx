import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  BRANA_IKONA_LAUNCHER_URL,
  BRANA_NAZEV,
  BRANA_POPIS,
  BRANA_PWA_DEN_BARVA,
} from "@/lib/brana";
import "./brana.css";

/** Zachytí beforeinstallprompt dříve než React bundle – uloží událost pro pwa-instalace.ts */
const BRANA_PWA_VCASNA_INSTALACE =
  'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__branaPwaVcasnyPrompt=e;window.dispatchEvent(new Event("brana-pwa-prompt"));},{capture:true});';

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

export default function BranaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="brana-root">
      <Script id="brana-pwa-vcasna-instalace" strategy="beforeInteractive">
        {BRANA_PWA_VCASNA_INSTALACE}
      </Script>
      {children}
    </div>
  );
}
