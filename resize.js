(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");

  var modeTabs = document.getElementById("modeTabs");
  var percentField = document.getElementById("percentField");
  var exactField = document.getElementById("exactField");
  var longedgeField = document.getElementById("longedgeField");

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

  var currentMode = "percent";
  var originalFile = null;
  var originalImage = null;
  var originalMime = "image/png";

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
      alert("이미지 파일만 지원해요.");
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
    percentField.style.display = currentMode === "percent" ? "grid" : "none";
    exactField.style.display = currentMode === "exact" ? "grid" : "none";
    longedgeField.style.display = currentMode === "longedge" ? "grid" : "none";
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

  convertBtn.addEventListener("click", function () {
    if (!originalImage) return;
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
          alert("변환에 실패했어요. 다른 형식으로 시도해보세요.");
          return;
        }
        var url = URL.createObjectURL(blob);
        afterImg.src = url;
        afterSize.textContent = formatBytes(blob.size);
        afterDims.textContent = dims.w + " × " + dims.h + "px";

        var savedPct = Math.min(99, Math.round((1 - blob.size / originalFile.size) * 100));
        if (savedPct > 0) {
          saveStat.textContent = "용량 " + savedPct + "% 절약됨";
          saveStat.style.display = "inline";
        } else {
          saveStat.textContent = "";
          saveStat.style.display = "none";
        }

        var ext = outMime === "image/png" ? "png" : outMime === "image/webp" ? "webp" : "jpg";
        var baseName = (originalFile.name || "image").replace(/\.[^.]+$/, "");
        downloadBtn.href = url;
        downloadBtn.download = baseName + "-resized." + ext;

        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      outMime,
      quality
    );
  });
})();
