(function () {
  var STORAGE_KEY = "iorikim-theme";

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    document.querySelectorAll("#themeToggle button").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
  }

  function getInitialTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  }

  var initial = getInitialTheme();
  applyTheme(initial);

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(initial);
    document.querySelectorAll("#themeToggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var theme = btn.dataset.theme;
        localStorage.setItem(STORAGE_KEY, theme);
        applyTheme(theme);
      });
    });
  });
})();
