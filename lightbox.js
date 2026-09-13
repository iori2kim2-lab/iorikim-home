(function () {
  var overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="닫기">✕</button>' +
    '<img class="lightbox-img" alt="" />';
  document.body.appendChild(overlay);

  var lightboxImg = overlay.querySelector(".lightbox-img");

  function open(src, alt) {
    if (!src) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
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
    var img = e.target.closest("[data-lightbox]");
    if (img && img.tagName === "IMG" && img.src) {
      open(img.src, img.alt);
    }
  });
})();
