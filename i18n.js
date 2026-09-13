(function () {
  var STORAGE_KEY = "iorikim-lang";
  var LANGS = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文(简体)" },
  ];

  function isSupported(code) {
    return LANGS.some(function (l) {
      return l.code === code;
    });
  }

  function detectInitial() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (isSupported(saved)) return saved;
    return "ko";
  }

  var currentLang = detectInitial();

  function resolve(dict, path) {
    var parts = path.split(".");
    var node = dict;
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function t(key, vars) {
    var data = window.I18N_DATA || {};
    var dict = data[currentLang] || data.ko || {};
    var fallback = data.ko || {};
    var val = resolve(dict, key);
    if (val === undefined) val = resolve(fallback, key);
    if (val === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        val = val.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return val;
  }

  window.t = t;
  window.getLang = function () {
    return currentLang;
  };

  function applyStaticText() {
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = t(key);
      if (el.hasAttribute("data-i18n-html")) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr")
        .split(";")
        .forEach(function (spec) {
          var parts = spec.split(":");
          if (parts.length === 2) {
            el.setAttribute(parts[0].trim(), t(parts[1].trim()));
          }
        });
    });

    var titleKey = document.body.getAttribute("data-i18n-title");
    if (titleKey) document.title = t(titleKey);
  }

  var switcherEl, currentLabelEl, menuEl;

  function buildSwitcher() {
    switcherEl = document.createElement("div");
    switcherEl.className = "lang-switcher";
    switcherEl.innerHTML =
      '<button class="lang-current" type="button" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="lang-current-label"></span><span class="lang-caret">▾</span>' +
      "</button>" +
      '<ul class="lang-menu" role="listbox" hidden></ul>';

    currentLabelEl = switcherEl.querySelector(".lang-current-label");
    menuEl = switcherEl.querySelector(".lang-menu");

    LANGS.forEach(function (l) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.lang = l.code;
      li.textContent = l.label;
      li.addEventListener("click", function () {
        setLang(l.code);
        closeMenu();
      });
      menuEl.appendChild(li);
    });

    var btn = switcherEl.querySelector(".lang-current");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menuEl.hasAttribute("hidden")) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    document.addEventListener("click", function () {
      closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    renderSwitcherState();
    return switcherEl;
  }

  function openMenu() {
    menuEl.removeAttribute("hidden");
    switcherEl.querySelector(".lang-current").setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    if (!menuEl) return;
    menuEl.setAttribute("hidden", "");
    if (switcherEl) switcherEl.querySelector(".lang-current").setAttribute("aria-expanded", "false");
  }

  function renderSwitcherState() {
    if (!currentLabelEl) return;
    var current =
      LANGS.filter(function (l) {
        return l.code === currentLang;
      })[0] || LANGS[0];
    currentLabelEl.textContent = current.label;
    menuEl.querySelectorAll("li").forEach(function (li) {
      li.classList.toggle("active", li.dataset.lang === currentLang);
    });
  }

  function setLang(code) {
    if (!isSupported(code)) return;
    currentLang = code;
    localStorage.setItem(STORAGE_KEY, code);
    applyStaticText();
    renderSwitcherState();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: code } }));
  }

  function mountSwitcher() {
    var themeToggle = document.getElementById("themeToggle");
    if (!themeToggle || themeToggle.closest(".nav-right")) return;
    var navRight = document.createElement("div");
    navRight.className = "nav-right";
    themeToggle.parentNode.insertBefore(navRight, themeToggle);
    navRight.appendChild(buildSwitcher());
    navRight.appendChild(themeToggle);
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountSwitcher();
    applyStaticText();
  });
})();
