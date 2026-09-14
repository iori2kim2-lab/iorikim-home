(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");

  var modeTabs = document.getElementById("modeTabs");
  var qualityField = document.getElementById("qualityField");
  var targetField = document.getElementById("targetField");
  var qualityRange = document.getElementById("qualityRange");
  var qualityValue = document.getElementById("qualityValue");
  var targetInput = document.getElementById("targetInput");
  var formatSelect = document.getElementById("formatSelect");
  var compressBtn = document.getElementById("compressBtn");

  var beforeImg = document.getElementById("beforeImg");
  var afterImg = document.getElementById("afterImg");
  var beforeSize = document.getElementById("beforeSize");
  var afterSize = document.getElementById("afterSize");
  var saveStat = document.getElementById("saveStat");
  var downloadBtn = document.getElementById("downloadBtn");

  var currentMode = "quality";
  var originalFile = null;
  var originalImage = null;
  var originalMime = "image/png";
  var sourceCanvas = null;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  dropzone.addEventListener("click", function () {
    fileInput.click();
  });
  ["dragover", "dragenter"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone.addEventListener("drop", function (e) {
    var file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      alert(t("common.imageOnlyAlert"));
      return;
    }
    originalFile = file;
    originalMime = file.type || "image/png";

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        originalImage = img;
        beforeImg.src = e.target.result;
        beforeSize.textContent = formatBytes(file.size);

        sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = img.naturalWidth;
        sourceCanvas.height = img.naturalHeight;
        sourceCanvas.getContext("2d").drawImage(img, 0, 0);

        controls.style.display = "grid";
        result.classList.remove("visible");
        formatSelect.value = "auto";
        if (currentMode === "quality") scheduleQualityPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  modeTabs.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    currentMode = btn.dataset.mode;
    modeTabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    qualityField.style.display = currentMode === "quality" ? "grid" : "none";
    targetField.style.display = currentMode === "target" ? "grid" : "none";
    compressBtn.style.display = currentMode === "target" ? "" : "none";
    if (currentMode === "quality" && sourceCanvas) scheduleQualityPreview();
  });

  // "Auto" picks WebP for anything that isn't already a lossy-friendly
  // format, since plain PNG re-encoded as PNG never actually shrinks.
  function outputMime() {
    if (formatSelect.value !== "auto") return formatSelect.value;
    if (originalMime === "image/jpeg" || originalMime === "image/webp") return originalMime;
    return "image/webp";
  }

  function compressAt(quality) {
    return new Promise(function (resolve) {
      sourceCanvas.toBlob(resolve, outputMime(), quality);
    });
  }

  function showResult(blob) {
    var mime = outputMime();
    var url = URL.createObjectURL(blob);
    afterImg.src = url;
    afterSize.textContent = formatBytes(blob.size);

    var savedPct = Math.round((1 - blob.size / originalFile.size) * 100);
    if (savedPct > 0) {
      saveStat.textContent = t("compress.savedPercent", { pct: savedPct });
    } else {
      saveStat.textContent = t("compress.noSaving");
    }
    saveStat.style.display = "inline";

    var ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    var baseName = (originalFile.name || "image").replace(/\.[^.]+$/, "");
    downloadBtn.href = url;
    downloadBtn.download = baseName + "-compressed." + ext;

    result.classList.add("visible");
  }

  var qualityTimer = null;
  function scheduleQualityPreview() {
    clearTimeout(qualityTimer);
    qualityTimer = setTimeout(runQualityPreview, 200);
  }
  async function runQualityPreview() {
    if (!sourceCanvas) return;
    var blob = await compressAt(Number(qualityRange.value) / 100);
    if (blob) showResult(blob);
  }

  qualityRange.addEventListener("input", function () {
    qualityValue.textContent = qualityRange.value;
    scheduleQualityPreview();
  });
  formatSelect.addEventListener("change", function () {
    if (currentMode === "quality" && sourceCanvas) scheduleQualityPreview();
  });

  // Binary-searches the quality (0.05–1.0) for the value that gets closest
  // to, without exceeding, the requested byte size.
  async function runTargetSearch() {
    if (!sourceCanvas) return;
    compressBtn.disabled = true;
    compressBtn.textContent = t("compress.searching");

    try {
      var targetBytes = Math.max(1, Number(targetInput.value) || 1) * 1024;
      var hiBlob = await compressAt(1.0);
      var best = hiBlob;

      if (hiBlob.size > targetBytes) {
        var loBlob = await compressAt(0.05);
        best = loBlob;
        if (loBlob.size <= targetBytes) {
          var lo = 0.05,
            hi = 1.0;
          for (var i = 0; i < 8; i++) {
            var mid = (lo + hi) / 2;
            var blob = await compressAt(mid);
            if (blob.size > targetBytes) {
              hi = mid;
            } else {
              lo = mid;
              best = blob;
            }
          }
        }
      }

      showResult(best);
    } finally {
      compressBtn.disabled = false;
      compressBtn.textContent = t("compress.compressBtn");
    }
  }

  compressBtn.addEventListener("click", function () {
    if (currentMode === "target") runTargetSearch();
  });

  document.addEventListener("langchange", function () {
    if (!compressBtn.disabled) compressBtn.textContent = t("compress.compressBtn");
  });
})();
