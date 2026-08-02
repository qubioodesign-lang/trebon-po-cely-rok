window.addEventListener(
  "beforeinstallprompt",
  function (e) {
    e.preventDefault();
    window.__branaPwaVcasnyPrompt = e;
    window.dispatchEvent(new Event("brana-pwa-prompt"));
  },
  { capture: true },
);
