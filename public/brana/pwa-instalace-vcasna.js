/**
 * Tenký early listener BIP pro BRÁNU.
 * Jediný store: window.__branaPwaInstalacniPrompt
 * Jediný guard: window.__branaPwaPosluchaceRegistrovani
 */
(function () {
  if (window.__branaPwaPosluchaceRegistrovani) {
    return;
  }

  window.__branaPwaPosluchaceRegistrovani = true;

  function oznamit() {
    window.dispatchEvent(new Event("brana-bip-ready"));
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window.__branaPwaInstalacniPrompt = e;
    oznamit();
  });

  window.addEventListener("appinstalled", function () {
    if (window.__branaPwaInstalacniPrompt) {
      delete window.__branaPwaInstalacniPrompt;
    }
    oznamit();
    window.dispatchEvent(new Event("brana-appinstalled"));
  });
})();
