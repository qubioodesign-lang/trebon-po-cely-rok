import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BranaCestyProvider } from "@/components/brana/BranaCestyProvider";
import { BranaPwaDiag } from "@/components/brana/BranaPwaDiag";
import {
  BRANA_IKONA_LAUNCHER_URL,
  BRANA_NAZEV,
  BRANA_POPIS,
} from "@/lib/brana";
import { jeBranaSubdomenaHost } from "@/lib/brana/cesty";
import "./brana.css";

/** Splash / systémové okolí PWA – stejná světle modrá jako ikona. */
const BRANA_SPLASH_BARVA = "#4585C5";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const naSubdomene = jeBranaSubdomenaHost(host);

  return {
    metadataBase: new URL("https://www.trebonpocelyrok.cz"),
    title: {
      default: "Třeboň",
      template: `%s · ${BRANA_NAZEV}`,
    },
    description: BRANA_POPIS,
    // Instalační manifest jen na subdoméně – www /brana není druhá PWA.
    ...(naSubdomene ? { manifest: "/brana/manifest.webmanifest" } : {}),
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BRANA_SPLASH_BARVA,
};

export default async function BranaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host");

  return (
    <div className="brana-root">
      <BranaCestyProvider host={host}>
        {children}
        <BranaPwaDiag />
      </BranaCestyProvider>
    </div>
  );
}
