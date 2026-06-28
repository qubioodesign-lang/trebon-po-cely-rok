/** Kritické styly a scroll-lock – platí okamžitě, ještě před Tailwind a Reactem */
export function GalerieKritickyCss() {
  const css = `
@media (max-width: 767px) {
  html.trebon-galerie-mobil,
  body.trebon-galerie-mobil {
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    overscroll-behavior: none;
    position: fixed;
    width: 100%;
  }
}
#trebon-ssr-galerie {
  position: fixed;
  inset: 0;
  z-index: 10;
  height: 100dvh;
  max-height: 100dvh;
  width: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background: #F5F3EF;
  opacity: 1;
}
#trebon-ssr-galerie .trebon-galerie-foto {
  position: absolute;
  inset: 0;
  z-index: 0;
}
#trebon-ssr-galerie .trebon-galerie-foto img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
`;

  const script = `
(function () {
  if (window.matchMedia("(max-width: 767px)").matches) {
    document.documentElement.classList.add("trebon-galerie-mobil");
    document.body.classList.add("trebon-galerie-mobil");
  }
})();
`;

  return (
    <>
      <style id="trebon-galerie-kriticky-css" dangerouslySetInnerHTML={{ __html: css }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
