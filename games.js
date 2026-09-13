(function () {
  var grid = document.getElementById("gamesGrid");
  if (!grid) return;

  var COMING_SOON = [
    '<div class="tool-card disabled">',
    '<div class="tool-icon">🎮</div>',
    "<h3>새 게임 준비 중</h3>",
    "<p>더 많은 미니게임을 계속 추가할 예정이에요.</p>",
    '<div class="badge-row"><span class="badge">준비 중</span></div>',
    '<span class="tool-cta">기대해주세요</span>',
    "</div>",
  ].join("");

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
      "<h3>" + escapeHtml(game.title || "이름 없는 게임") + "</h3>",
      "</div>",
      "<p>" + escapeHtml(game.description || "") + "</p>",
      '<div class="badge-row"><span class="badge">무료</span><span class="badge">게임</span></div>',
      '<span class="tool-cta">플레이하기 →</span>',
      "</div>",
      "</a>",
    ].join("");
  }

  fetch("games/games.json")
    .then(function (res) {
      if (!res.ok) throw new Error("failed to load games.json");
      return res.json();
    })
    .then(function (games) {
      grid.innerHTML = games.map(renderGame).join("") + COMING_SOON;
    })
    .catch(function () {
      grid.innerHTML = COMING_SOON;
    });
})();
