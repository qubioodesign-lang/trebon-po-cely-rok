/** Dočasné – značka v HTML streamu stránky (?test=2), ještě před hydratací galerie */
export function DiagPageHtmlMarker() {
  const kod = `
(function () {
  if (!/[?&]test=2(?:&|$)/.test(location.search)) return;
  window.__TREBON_DIAG = window.__TREBON_DIAG || {};
  window.__TREBON_DIAG.pageHtml = Math.round(performance.now());
  window.dispatchEvent(new CustomEvent("trebon-diag"));
})();
`;

  return (
    <script
      id="trebon-diag-page-html"
      dangerouslySetInnerHTML={{ __html: kod }}
    />
  );
}
