/** Dočasné – synchronní měření před hydratací Reactu (?test=2) */
export function DiagInicializaceBootScript() {
  const kod = `
(function () {
  if (!/[?&]test=2(?:&|$)/.test(location.search)) return;
  var w = window;
  var d = { nav: Math.round(performance.now()) };
  var nav = performance.getEntriesByType("navigation")[0];
  if (nav) d.html = Math.round(nav.responseEnd);
  w.__TREBON_DIAG = d;

  function zaznamenatSkript(entry) {
    if (entry.initiatorType !== "script") return;
    var url = entry.name;
    var cas = Math.round(entry.responseEnd);
    if (url.indexOf("webpack") !== -1 && d.webpack === undefined) d.webpack = cas;
    if (url.indexOf("main-app") !== -1 && d.mainApp === undefined) d.mainApp = cas;
    if (url.indexOf("/layout") !== -1 && url.indexOf(".js") !== -1 && d.layoutJs === undefined) {
      d.layoutJs = cas;
    }
    if (url.indexOf("/page") !== -1 && url.indexOf(".js") !== -1 && d.pageJs === undefined) {
      d.pageJs = cas;
    }
  }

  function skenovatSkripty() {
    performance.getEntriesByType("resource").forEach(zaznamenatSkript);
  }

  function panel() {
    var x = w.__TREBON_DIAG || {};
    return [
      "nyní: " + Math.round(performance.now()),
      "nav: " + (x.nav ?? "—"),
      "html: " + (x.html ?? "—"),
      "dom: " + (x.dom ?? "—"),
      "pageHtml: " + (x.pageHtml ?? "—"),
      "webpack: " + (x.webpack ?? "—"),
      "mainApp: " + (x.mainApp ?? "—"),
      "layoutJs: " + (x.layoutJs ?? "—"),
      "pageJs: " + (x.pageJs ?? "—"),
      "layoutHydrate: " + (x.layoutHydrate ?? "—"),
      "modulGalerie: " + (x.modulGalerie ?? "—"),
      "indexPolozky: " + (x.indexPolozky ?? "—"),
      "galerieRender: " + (x.galerieRender ?? "—"),
      "galerie: " + (x.galerie ?? "—"),
      "page srv: " + (x.pageServerTrvani ?? "—"),
      "api srv: " + (x.apiServerTrvani ?? "—"),
      "prolnuti: " + (x.prolnuti ?? "—"),
      "A: " + (x.prolnutiA ?? "—"),
      "B: " + (x.prolnutiB ?? "—"),
      "prolnutí: " + (x.prolnutiStart ?? "—")
    ].join("\\n");
  }

  function upd() {
    var el = document.getElementById("trebon-diag-boot");
    if (!el) {
      el = document.createElement("div");
      el.id = "trebon-diag-boot";
      el.setAttribute(
        "style",
        "position:fixed;top:8px;left:8px;z-index:9999;font:10px/1.4 monospace;background:rgba(0,0,0,.55);color:#bbf7d0;padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre;max-width:92vw"
      );
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = panel();
  }

  upd();
  w.addEventListener("trebon-diag", upd);
  skenovatSkripty();

  if (typeof PerformanceObserver !== "undefined") {
    try {
      var obs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(zaznamenatSkript);
        upd();
        w.dispatchEvent(new CustomEvent("trebon-diag"));
      });
      obs.observe({ type: "resource", buffered: true });
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    d.dom = Math.round(performance.now());
    skenovatSkripty();
    upd();
    w.dispatchEvent(new CustomEvent("trebon-diag"));
  });
})();
`;

  return (
    <script
      id="trebon-diag-boot-script"
      dangerouslySetInnerHTML={{ __html: kod }}
    />
  );
}
