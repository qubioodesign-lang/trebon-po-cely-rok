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
