import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zkouška otevření v Chromu",
  robots: { index: false, follow: false },
};

/** Veřejná Třeboň v aplikaci Chrome. Stejný princip intent:// jako u BRÁNY, bez jejího parametru. */
const ODKAZ_CHROME =
  "intent://www.trebonpocelyrok.cz/#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fwww.trebonpocelyrok.cz%2F;end";

export default function ZkouskaChromePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-krem px-8">
      <a href={ODKAZ_CHROME} className="tlacitko-klidne">
        Otevřít v Chromu
      </a>
    </main>
  );
}
