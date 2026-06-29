"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  formatDiagCas,
  jeDiagTest2,
  msOdNav,
  zaznamenatDiag,
  ziskatDiag,
  type DiagData,
} from "@/lib/diag-inicializace";

function formatPanel(data: DiagData, nyni: number): string {
  return [
    `nyní: ${nyni}`,
    `nav: ${formatDiagCas(data.nav)}`,
    `html: ${formatDiagCas(data.html)}`,
    `dom: ${formatDiagCas(data.dom)}`,
    `pageHtml: ${formatDiagCas(data.pageHtml)}`,
    `webpack: ${formatDiagCas(data.webpack)}`,
    `mainApp: ${formatDiagCas(data.mainApp)}`,
    `layoutJs: ${formatDiagCas(data.layoutJs)}`,
    `pageJs: ${formatDiagCas(data.pageJs)}`,
    `layoutHydrate: ${formatDiagCas(data.layoutHydrate)}`,
    `modulGalerie: ${formatDiagCas(data.modulGalerie)}`,
    `indexPolozky: ${formatDiagCas(data.indexPolozky)}`,
    `galerieRender: ${formatDiagCas(data.galerieRender)}`,
    `galerie: ${formatDiagCas(data.galerie)}`,
    `page srv: ${formatDiagCas(data.pageServerTrvani)}`,
    `api srv: ${formatDiagCas(data.apiServerTrvani)}`,
    `prolnuti: ${formatDiagCas(data.prolnuti)}`,
    `A: ${formatDiagCas(data.prolnutiA)}`,
    `B: ${formatDiagCas(data.prolnutiB)}`,
    `prolnutí: ${formatDiagCas(data.prolnutiStart)}`,
  ].join("\n");
}

/** Dočasné – zobrazí se jen s ?test=2; nav/html zachytí boot script před Reactem */
export function DiagInicializaceOverlay() {
  const [aktivni, setAktivni] = useState(false);
  const [data, setData] = useState<DiagData>({});
  const [nyni, setNyni] = useState(0);

  useLayoutEffect(() => {
    if (jeDiagTest2()) {
      zaznamenatDiag("layoutHydrate");
    }
  }, []);

  useEffect(() => {
    if (!jeDiagTest2()) return;
    setAktivni(true);

    const obnovit = () => setData({ ...ziskatDiag() });
    obnovit();

    window.addEventListener("trebon-diag", obnovit);

    let raf = 0;
    const tick = () => {
      setNyni(msOdNav());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const boot = document.getElementById("trebon-diag-boot");
    if (boot) boot.style.display = "none";

    return () => {
      window.removeEventListener("trebon-diag", obnovit);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!aktivni) return null;

  return (
    <div
      className="pointer-events-none fixed left-2 top-2 z-[9999] whitespace-pre rounded bg-black/55 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-lime-300"
      aria-hidden="true"
    >
      {formatPanel(data, nyni)}
    </div>
  );
}
