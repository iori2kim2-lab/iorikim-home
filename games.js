(function () {
  var grid = document.getElementById("gamesGrid");
  if (!grid) return;

  var games = null;

  function tr(field) {
    if (!field) return "";
    var lang = window.getLang ? window.getLang() : "ko";
    return field[lang] || field.ko || "";
  }

  function comingSoonCard() {
    return [
      '<div class="tool-card disabled">',
      '<div class="tool-icon">🎮</div>',
      "<h3>" + t("index.comingSoonGameTitle") + "</h3>",
      "<p>" + t("index.comingSoonGameDesc") + "</p>",
      '<div class="badge-row"><span class="badge">' + t("common.comingSoonBadge") + "</span></div>",
      '<span class="tool-cta">' + t("common.comingSoonCta") + "</span>",
      "</div>",
    ].join("");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderGame(game) {
    var preview = game.preview
      ? '<img class="tool-preview" src="' + escapeHtml(game.preview) + '" alt="" />'
      : "";
    return [
      '<a class="tool-card" href="games/' + encodeURIComponent(game.file) + '">',
      preview,
      '<div class="tool-card-body">',
      '<div class="tool-title-row">',
      '<span class="tool-emoji">' + escapeHtml(game.icon || "🎮") + "</span>",
      "<h3>" + escapeHtml(tr(game.title) || "이름 없는 게임") + "</h3>",
      "</div>",
      "<p>" + escapeHtml(tr(game.description)) + "</p>",
      '<div class="badge-row"><span class="badge">' +
        t("common.freeBadge") +
        '</span><span class="badge">' +
        t("index.badgeGame") +
        "</span></div>",
      '<span class="tool-cta">' + t("index.playCta") + "</span>",
      "</div>",
      "</a>",
    ].join("");
  }

  function render() {
    if (!games) return;
    grid.innerHTML = games.map(renderGame).join("") + comingSoonCard();
  }

  fetch("games/games.json")
    .then(function (res) {
      if (!res.ok) throw new Error("failed to load games.json");
      return res.json();
    })
    .then(function (data) {
      games = data;
      render();
    })
    .catch(function () {
      grid.innerHTML = comingSoonCard();
    });

  document.addEventListener("langchange", render);
})();
