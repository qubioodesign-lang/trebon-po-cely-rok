(function () {
  try {
    var url = new URL(window.location.href);
    if (url.searchParams.get("otevrenoVChromu") === "1") {
      sessionStorage.removeItem("brana_embedded_android");
      sessionStorage.setItem("brana_plny_chrome", "1");
    }
  } catch (e) {
    // ignorovat – hlavní logika běží v bundlu
  }
})();

window.addEventListener(
  "beforeinstallprompt",
  function (e) {
    e.preventDefault();
    window.__branaPwaInstalacniPrompt = e;
    window.__branaPwaVcasnyPrompt = e;
    window.dispatchEvent(new Event("brana-pwa-prompt"));
  },
  { capture: true },
);
