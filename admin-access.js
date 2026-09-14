// Reveals a small "Cloudflare dashboard" shortcut button, but only after a
// secret key combo (Ctrl+Shift+Alt+C) is pressed. Nobody else knows the
// combo, so in practice only the site owner ever sees the button. This is
// obscurity, not real access control — the dashboard link itself still
// requires a Cloudflare login, so it's harmless even if someone stumbles on it.
(function () {
  var STORAGE_KEY = "iorikim-admin-visible";
  var DASHBOARD_URL = "https://dash.cloudflare.com/4b7cc34b47dc919ba5d975eb03772f94/home";

  function createButton() {
    var btn = document.createElement("a");
    btn.id = "cfAdminBtn";
    btn.className = "cf-admin-btn";
    btn.href = DASHBOARD_URL;
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.title = "Cloudflare 대시보드";
    btn.textContent = "☁️ Cloudflare";
    document.body.appendChild(btn);
  }

  function showButton() {
    if (!document.getElementById("cfAdminBtn")) createButton();
  }

  function hideButton() {
    var btn = document.getElementById("cfAdminBtn");
    if (btn) btn.remove();
  }

  function toggle() {
    var visible = localStorage.getItem(STORAGE_KEY) === "1";
    if (visible) {
      localStorage.removeItem(STORAGE_KEY);
      hideButton();
    } else {
      localStorage.setItem(STORAGE_KEY, "1");
      showButton();
    }
  }

  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") showButton();
  } catch (e) {}

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      toggle();
    }
  });
})();
