(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");
  var iconSetResult = document.getElementById("iconSetResult");

  var modeTabs = document.getElementById("modeTabs");
  var percentField = document.getElementById("percentField");
  var exactField = document.getElementById("exactField");
  var longedgeField = document.getElementById("longedgeField");
  var storeInfoField = document.getElementById("storeInfoField");
  var storeInfoText = document.getElementById("storeInfoText");
  var formatField = document.getElementById("formatField");

  var percentRange = document.getElementById("percentRange");
  var percentValue = document.getElementById("percentValue");
  var widthInput = document.getElementById("widthInput");
  var heightInput = document.getElementById("heightInput");
  var lockAspect = document.getElementById("lockAspect");
  var longEdgeInput = document.getElementById("longEdgeInput");

  var formatSelect = document.getElementById("formatSelect");
  var qualityField = document.getElementById("qualityField");
  var qualityRange = document.getElementById("qualityRange");
  var qualityValue = document.getElementById("qualityValue");

  var convertBtn = document.getElementById("convertBtn");
  var beforeImg = document.getElementById("beforeImg");
  var afterImg = document.getElementById("afterImg");
  var beforeSize = document.getElementById("beforeSize");
  var afterSize = document.getElementById("afterSize");
  var beforeDims = document.getElementById("beforeDims");
  var afterDims = document.getElementById("afterDims");
  var saveStat = document.getElementById("saveStat");
  var downloadBtn = document.getElementById("downloadBtn");

  var iconGrid = document.getElementById("iconGrid");
  var iconSetSummary = document.getElementById("iconSetSummary");
  var iconZipBtn = document.getElementById("iconZipBtn");

  var currentMode = "percent";
  var originalFile = null;
  var originalImage = null;
  var originalMime = "image/png";

  var STORE_MODES = ["google-play", "apple-store"];

  var ICON_SPECS = {
    "google-play": {
      infoKey: "resize.storeInfoGooglePlay",
      background: null,
      zipName: "google-play-icons.zip",
      icons: [
        { name: "play-store-icon-512.png", size: 512 },
        { name: "mipmap-mdpi/ic_launcher.png", size: 48 },
        { name: "mipmap-hdpi/ic_launcher.png", size: 72 },
        { name: "mipmap-xhdpi/ic_launcher.png", size: 96 },
        { name: "mipmap-xxhdpi/ic_launcher.png", size: 144 },
        { name: "mipmap-xxxhdpi/ic_launcher.png", size: 192 },
      ],
    },
    "apple-store": {
      infoKey: "resize.storeInfoAppleStore",
      background: "#ffffff",
      zipName: "app-store-icons.zip",
      icons: [
        { name: "icon-1024.png", size: 1024 },
        { name: "icon-180.png", size: 180 },
        { name: "icon-167.png", size: 167 },
        { name: "icon-152.png", size: 152 },
        { name: "icon-120.png", size: 120 },
        { name: "icon-87.png", size: 87 },
        { name: "icon-80.png", size: 80 },
        { name: "icon-76.png", size: 76 },
        { name: "icon-60.png", size: 60 },
        { name: "icon-58.png", size: 58 },
        { name: "icon-40.png", size: 40 },
        { name: "icon-29.png", size: 29 },
        { name: "icon-20.png", size: 20 },
      ],
    },
  };

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
        beforeDims.textContent = img.naturalWidth + " × " + img.naturalHeight + "px";

        widthInput.value = img.naturalWidth;
        heightInput.value = img.naturalHeight;

        controls.style.display = "grid";
        result.classList.remove("visible");
        iconSetResult.classList.remove("visible");
        formatSelect.value = "auto";
        updateQualityVisibility();
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

    var isStoreMode = STORE_MODES.indexOf(currentMode) !== -1;

    percentField.style.display = currentMode === "percent" ? "grid" : "none";
    exactField.style.display = currentMode === "exact" ? "grid" : "none";
    longedgeField.style.display = currentMode === "longedge" ? "grid" : "none";
    formatField.style.display = isStoreMode ? "none" : "grid";
    qualityField.style.display = isStoreMode ? "none" : qualityField.style.display;

    if (isStoreMode) {
      storeInfoField.style.display = "block";
      storeInfoText.textContent = t(ICON_SPECS[currentMode].infoKey);
      convertBtn.textContent = t("resize.makeIconSetBtn");
    } else {
      storeInfoField.style.display = "none";
      convertBtn.textContent = t("resize.convertBtn");
      updateQualityVisibility();
    }

    result.classList.remove("visible");
    iconSetResult.classList.remove("visible");
  });

  percentRange.addEventListener("input", function () {
    percentValue.textContent = percentRange.value;
  });

  var aspectRatio = 1;
  widthInput.addEventListener("input", function () {
    if (!lockAspect.checked || !originalImage) return;
    aspectRatio = originalImage.naturalWidth / originalImage.naturalHeight;
    heightInput.value = Math.round(widthInput.value / aspectRatio);
  });
  heightInput.addEventListener("input", function () {
    if (!lockAspect.checked || !originalImage) return;
    aspectRatio = originalImage.naturalWidth / originalImage.naturalHeight;
    widthInput.value = Math.round(heightInput.value * aspectRatio);
  });

  qualityRange.addEventListener("input", function () {
    qualityValue.textContent = qualityRange.value;
  });

  function updateQualityVisibility() {
    var fmt = formatSelect.value === "auto" ? originalMime : formatSelect.value;
    qualityField.style.display = fmt === "image/png" ? "none" : "grid";
  }
  formatSelect.addEventListener("change", updateQualityVisibility);

  function computeTargetDims() {
    var w = originalImage.naturalWidth;
    var h = originalImage.naturalHeight;

    if (currentMode === "percent") {
      var pct = Number(percentRange.value) / 100;
      return { w: Math.max(1, Math.round(w * pct)), h: Math.max(1, Math.round(h * pct)) };
    }
    if (currentMode === "exact") {
      return {
        w: Math.max(1, Number(widthInput.value) || w),
        h: Math.max(1, Number(heightInput.value) || h),
      };
    }
    if (currentMode === "longedge") {
      var maxEdge = Number(longEdgeInput.value) || Math.max(w, h);
      var scale = Math.min(1, maxEdge / Math.max(w, h));
      return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
    }
    return { w: w, h: h };
  }

  function drawIconCanvas(size, background) {
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(originalImage, 0, 0, size, size);
    return canvas;
  }

  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, "image/png");
    });
  }

  async function generateIconSet(specKey) {
    var spec = ICON_SPECS[specKey];
    convertBtn.disabled = true;
    convertBtn.textContent = t("resize.generatingIcons");
    iconGrid.innerHTML = "";

    var zip = new JSZip();
    var totalBytes = 0;

    for (var i = 0; i < spec.icons.length; i++) {
      var item = spec.icons[i];
      var canvas = drawIconCanvas(item.size, spec.background);
      var blob = await canvasToPngBlob(canvas);
      if (!blob) continue;
      totalBytes += blob.size;
      zip.file(item.name, blob);

      var url = URL.createObjectURL(blob);
      var fig = document.createElement("figure");
      var displayName = item.name.split("/").pop();
      fig.innerHTML =
        '<img src="' + url + '" alt="' + displayName + '" />' +
        "<figcaption><b>" + item.size + "×" + item.size + "</b>" + displayName + "</figcaption>";
      iconGrid.appendChild(fig);
    }

    var zipBlob = await zip.generateAsync({ type: "blob" });
    var zipUrl = URL.createObjectURL(zipBlob);
    iconZipBtn.href = zipUrl;
    iconZipBtn.download = spec.zipName;
    iconSetSummary.textContent = t("resize.iconSummary", {
      count: spec.icons.length,
      size: formatBytes(zipBlob.size),
    });

    convertBtn.disabled = false;
    convertBtn.textContent = t("resize.makeIconSetBtn");

    result.classList.remove("visible");
    iconSetResult.classList.add("visible");
    iconSetResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function convertSingleImage() {
    var dims = computeTargetDims();

    var canvas = document.createElement("canvas");
    canvas.width = dims.w;
    canvas.height = dims.h;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(originalImage, 0, 0, dims.w, dims.h);

    var outMime = formatSelect.value === "auto" ? originalMime : formatSelect.value;
    if (outMime !== "image/png" && outMime !== "image/jpeg" && outMime !== "image/webp") {
      outMime = "image/jpeg";
    }
    var quality = Number(qualityRange.value) / 100;

    canvas.toBlob(
      function (blob) {
        if (!blob) {
          alert(t("resize.convertFailAlert"));
          return;
        }
        var url = URL.createObjectURL(blob);
        afterImg.src = url;
        afterSize.textContent = formatBytes(blob.size);
        afterDims.textContent = dims.w + " × " + dims.h + "px";

        var savedPct = Math.min(99, Math.round((1 - blob.size / originalFile.size) * 100));
        if (savedPct > 0) {
          saveStat.textContent = t("resize.savedPercent", { pct: savedPct });
          saveStat.style.display = "inline";
        } else {
          saveStat.textContent = "";
          saveStat.style.display = "none";
        }

        var ext = outMime === "image/png" ? "png" : outMime === "image/webp" ? "webp" : "jpg";
        var baseName = (originalFile.name || "image").replace(/\.[^.]+$/, "");
        downloadBtn.href = url;
        downloadBtn.download = baseName + "-resized." + ext;

        iconSetResult.classList.remove("visible");
        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      outMime,
      quality
    );
  }

  convertBtn.addEventListener("click", function () {
    if (!originalImage) return;
    if (STORE_MODES.indexOf(currentMode) !== -1) {
      generateIconSet(currentMode);
    } else {
      convertSingleImage();
    }
  });

  document.addEventListener("langchange", function () {
    if (convertBtn.disabled) return;
    if (STORE_MODES.indexOf(currentMode) !== -1) {
      storeInfoText.textContent = t(ICON_SPECS[currentMode].infoKey);
      convertBtn.textContent = t("resize.makeIconSetBtn");
    } else {
      convertBtn.textContent = t("resize.convertBtn");
    }
  });
})();
