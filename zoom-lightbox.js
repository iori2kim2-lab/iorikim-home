(function () {
  var DEFAULT_ZOOM = 2;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 8;
  var WHEEL_STEP = 1.15;

  var overlay = document.createElement("div");
  overlay.className = "lightbox-overlay zoom-lightbox";
  overlay.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="닫기">✕</button>' +
    '<div class="zoom-hint">스크롤로 확대·축소 · 드래그로 이동</div>' +
    '<div class="zoom-viewport"><img class="lightbox-img zoom-img" alt="" /></div>';
  document.body.appendChild(overlay);

  var viewport = overlay.querySelector(".zoom-viewport");
  var img = overlay.querySelector(".zoom-img");

  var scale = DEFAULT_ZOOM;
  var posX = 0;
  var posY = 0;
  var dragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var startPosX = 0;
  var startPosY = 0;
  var moved = false;

  function applyTransform() {
    img.style.transform = "translate(" + posX + "px, " + posY + "px) scale(" + scale + ")";
  }

  function resetView() {
    scale = DEFAULT_ZOOM;
    posX = 0;
    posY = 0;
    applyTransform();
  }

  function open(src, alt) {
    if (!src) return;
    img.src = src;
    img.alt = alt || "";
    resetView();
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) {
      close();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  document.addEventListener("click", function (e) {
    if (dragging || moved) return;
    var el = e.target.closest("[data-lightbox]");
    if (el && el.tagName === "IMG" && el.src) {
      open(el.src, el.alt);
    }
  });

  viewport.addEventListener("wheel", function (e) {
    e.preventDefault();
    var rect = viewport.getBoundingClientRect();
    var cx = e.clientX - rect.left - rect.width / 2;
    var cy = e.clientY - rect.top - rect.height / 2;
    var factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    var newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * factor));
    var ratio = newScale / scale;
    posX = cx - (cx - posX) * ratio;
    posY = cy - (cy - posY) * ratio;
    scale = newScale;
    applyTransform();
  }, { passive: false });

  img.addEventListener("mousedown", function (e) {
    e.preventDefault();
    dragging = true;
    moved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startPosX = posX;
    startPosY = posY;
    img.classList.add("dragging");
  });

  window.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    posX = startPosX + dx;
    posY = startPosY + dy;
    applyTransform();
  });

  window.addEventListener("mouseup", function () {
    if (!dragging) return;
    dragging = false;
    img.classList.remove("dragging");
    setTimeout(function () {
      moved = false;
    }, 0);
  });

  // touch support: one-finger drag to pan, pinch to zoom
  var pinchStartDist = null;
  var pinchStartScale = 1;

  function touchDist(t0, t1) {
    var dx = t0.clientX - t1.clientX;
    var dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  img.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length === 1) {
        dragging = true;
        moved = false;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startPosX = posX;
        startPosY = posY;
      } else if (e.touches.length === 2) {
        dragging = false;
        pinchStartDist = touchDist(e.touches[0], e.touches[1]);
        pinchStartScale = scale;
      }
    },
    { passive: true }
  );

  img.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length === 1 && dragging) {
        var dx = e.touches[0].clientX - dragStartX;
        var dy = e.touches[0].clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        posX = startPosX + dx;
        posY = startPosY + dy;
        applyTransform();
      } else if (e.touches.length === 2 && pinchStartDist) {
        var dist = touchDist(e.touches[0], e.touches[1]);
        scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartScale * (dist / pinchStartDist)));
        applyTransform();
      }
    },
    { passive: true }
  );

  img.addEventListener("touchend", function () {
    dragging = false;
    pinchStartDist = null;
  });
})();
