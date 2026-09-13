(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");

  var formatSelect = document.getElementById("formatSelect");
  var qualityField = document.getElementById("qualityField");
  var qualityRange = document.getElementById("qualityRange");
  var qualityValue = document.getElementById("qualityValue");
  var convertBtn = document.getElementById("convertBtn");

  var beforeFigure = document.getElementById("beforeFigure");
  var afterFigure = document.getElementById("afterFigure");
  var statsRow = document.getElementById("statsRow");
  var beforeImg = document.getElementById("beforeImg");
  var afterImg = document.getElementById("afterImg");
  var beforeSize = document.getElementById("beforeSize");
  var afterSize = document.getElementById("afterSize");
  var beforeDims = document.getElementById("beforeDims");
  var afterDims = document.getElementById("afterDims");
  var saveStat = document.getElementById("saveStat");
  var downloadBtn = document.getElementById("downloadBtn");

  var dropzoneTitle = dropzone.querySelector("strong");

  var originalFile = null;
  var originalImage = null;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function isHeic(file) {
    var name = (file.name || "").toLowerCase();
    var type = (file.type || "").toLowerCase();
    return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
  }

  function isPsd(file) {
    var name = (file.name || "").toLowerCase();
    var type = (file.type || "").toLowerCase();
    return type === "image/vnd.adobe.photoshop" || name.endsWith(".psd") || name.endsWith(".psb");
  }

  var psdModulePromise = null;
  function loadPsdModule() {
    if (!psdModulePromise) {
      psdModulePromise = import("https://cdn.jsdelivr.net/npm/ag-psd@31.0.2/+esm");
    }
    return psdModulePromise;
  }

  async function psdToDataUrl(file) {
    var mod = await loadPsdModule();
    var buffer = await file.arrayBuffer();
    var psd = mod.readPsd(buffer, { skipLayerImageData: true });
    if (!psd.canvas) throw new Error("PSD has no renderable composite image");
    return psd.canvas.toDataURL("image/png");
  }

  function detectFormatLabel(file) {
    if (isHeic(file)) return "HEIC";
    if (isPsd(file)) return "PSD";
    var type = (file.type || "").toLowerCase();
    if (type === "image/jpeg") return "JPEG";
    if (type === "image/png") return "PNG";
    if (type === "image/webp") return "WebP";
    if (type === "image/gif") return "GIF";
    if (type === "image/bmp") return "BMP";
    var ext = (file.name || "").split(".").pop();
    return ext ? ext.toUpperCase() : "이미지";
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
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

  async function handleFile(file) {
    var looksLikeImage = file.type.startsWith("image/") || isHeic(file) || isPsd(file);
    if (!looksLikeImage) {
      alert(t("common.imageOnlyAlert"));
      return;
    }

    originalFile = file;
    dropzoneTitle.textContent = isHeic(file)
      ? t("convert.decodingHeic")
      : isPsd(file)
      ? t("convert.decodingPsd")
      : t("common.loading");

    try {
      var dataUrl;
      if (isHeic(file)) {
        var convertedBlob = await heic2any({ blob: file, toType: "image/png" });
        if (Array.isArray(convertedBlob)) convertedBlob = convertedBlob[0];
        dataUrl = await blobToDataUrl(convertedBlob);
      } else if (isPsd(file)) {
        dataUrl = await psdToDataUrl(file);
      } else {
        dataUrl = await blobToDataUrl(file);
      }

      var img = await loadImage(dataUrl);
      originalImage = img;
      beforeImg.src = dataUrl;
      beforeSize.textContent = formatBytes(file.size);
      beforeDims.textContent =
        img.naturalWidth + " × " + img.naturalHeight + "px · " + detectFormatLabel(file);

      controls.style.display = "grid";
      afterFigure.hidden = true;
      statsRow.hidden = true;
      downloadBtn.hidden = true;
      result.classList.add("visible");
      updateQualityVisibility();
    } catch (err) {
      console.error(err);
      alert(t("convert.loadFailAlert"));
    } finally {
      dropzoneTitle.textContent = t("common.dropzoneDefault");
    }
  }

  qualityRange.addEventListener("input", function () {
    qualityValue.textContent = qualityRange.value;
  });

  function updateQualityVisibility() {
    qualityField.style.display = formatSelect.value === "image/png" ? "none" : "grid";
  }
  formatSelect.addEventListener("change", updateQualityVisibility);

  convertBtn.addEventListener("click", function () {
    if (!originalImage) return;

    var canvas = document.createElement("canvas");
    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
    var ctx = canvas.getContext("2d");

    var outMime = formatSelect.value;
    if (outMime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(originalImage, 0, 0);

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
        afterDims.textContent = canvas.width + " × " + canvas.height + "px";

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
        downloadBtn.download = baseName + "." + ext;

        afterFigure.hidden = false;
        statsRow.hidden = false;
        downloadBtn.hidden = false;
        afterFigure.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      outMime,
      quality
    );
  });
})();
