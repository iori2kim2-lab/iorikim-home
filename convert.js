(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");
  var bulkResult = document.getElementById("bulkResult");

  var stackField = document.getElementById("stackField");
  var stackLabel = document.getElementById("stackLabel");
  var stackPile = document.getElementById("stackPile");

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
  var sendToUpscaleBtn = document.getElementById("sendToUpscaleBtn");

  var bulkSummary = document.getElementById("bulkSummary");
  var bulkGrid = document.getElementById("bulkGrid");
  var bulkZipBtn = document.getElementById("bulkZipBtn");

  var MAX_FILES = 10;

  var lastConvertedBlob = null;
  var lastConvertedName = null;

  var dropzoneTitle = dropzone.querySelector("strong");

  var originalFile = null;
  var originalImage = null;
  var items = []; // populated only in bulk mode (2-10 files): {file, img, dataUrl}

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

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  async function decodeFile(file) {
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
    return { file: file, img: img, dataUrl: dataUrl };
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
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener("change", function () {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });

  async function handleFiles(fileListInput) {
    var files = Array.from(fileListInput || []).filter(function (f) {
      return f.type.startsWith("image/") || isHeic(f) || isPsd(f);
    });
    if (!files.length) {
      if (fileListInput && fileListInput.length) alert(t("common.imageOnlyAlert"));
      return;
    }

    var truncated = files.length > MAX_FILES;
    if (truncated) files = files.slice(0, MAX_FILES);

    dropzoneTitle.textContent = t("common.loading");
    result.classList.remove("visible");
    bulkResult.classList.remove("visible");
    lastConvertedBlob = null;

    try {
      if (files.length === 1) {
        items = [];
        stackField.hidden = true;
        await handleSingleFile(files[0]);
      } else {
        originalFile = null;
        originalImage = null;
        var decoded = [];
        for (var i = 0; i < files.length; i++) {
          try {
            decoded.push(await decodeFile(files[i]));
          } catch (err) {
            console.error(err);
          }
        }
        if (!decoded.length) {
          alert(t("convert.loadFailAlert"));
          return;
        }
        items = decoded;
        renderStackPile();
        controls.style.display = "grid";
        updateQualityVisibility();
      }
      if (truncated) alert(t("convert.maxFilesAlert"));
    } catch (err) {
      console.error(err);
      alert(t("convert.loadFailAlert"));
    } finally {
      dropzoneTitle.textContent = t("common.dropzoneDefault");
    }
  }

  async function handleSingleFile(file) {
    originalFile = file;
    var decoded = await decodeFile(file);
    originalImage = decoded.img;
    beforeImg.src = decoded.dataUrl;
    beforeSize.textContent = formatBytes(file.size);
    beforeDims.textContent =
      decoded.img.naturalWidth + " × " + decoded.img.naturalHeight + "px · " + detectFormatLabel(file);

    controls.style.display = "grid";
    afterFigure.hidden = true;
    statsRow.hidden = true;
    downloadBtn.hidden = true;
    sendToUpscaleBtn.hidden = true;
    result.classList.add("visible");
    updateQualityVisibility();
  }

  function renderStackPile() {
    stackLabel.textContent = t("convert.stackLabel", { count: items.length });
    stackPile.innerHTML = "";
    items.forEach(function (item, idx) {
      var card = document.createElement("div");
      card.className = "stack-card";
      card.style.setProperty("--rot", (idx % 2 === 0 ? -1 : 1) * (4 + (idx % 3)) + "deg");
      card.style.zIndex = String(idx);
      var img = document.createElement("img");
      img.src = item.dataUrl;
      img.alt = "";
      card.appendChild(img);
      stackPile.appendChild(card);
    });
    stackField.hidden = false;
  }

  qualityRange.addEventListener("input", function () {
    qualityValue.textContent = qualityRange.value;
  });

  function updateQualityVisibility() {
    qualityField.style.display = formatSelect.value === "image/png" ? "none" : "grid";
  }
  formatSelect.addEventListener("change", updateQualityVisibility);

  function imageToBlob(img, outMime, quality) {
    return new Promise(function (resolve) {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      if (outMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        function (blob) {
          resolve({ blob: blob, width: canvas.width, height: canvas.height });
        },
        outMime,
        quality
      );
    });
  }

  function convertSingle() {
    var outMime = formatSelect.value;
    var quality = Number(qualityRange.value) / 100;

    imageToBlob(originalImage, outMime, quality).then(function (res) {
      var blob = res.blob;
      if (!blob) {
        alert(t("resize.convertFailAlert"));
        return;
      }
      var url = URL.createObjectURL(blob);
      afterImg.src = url;
      afterSize.textContent = formatBytes(blob.size);
      afterDims.textContent = res.width + " × " + res.height + "px";

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

      lastConvertedBlob = blob;
      lastConvertedName = baseName + "." + ext;

      afterFigure.hidden = false;
      statsRow.hidden = false;
      downloadBtn.hidden = false;
      sendToUpscaleBtn.hidden = false;
      afterFigure.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function convertBulk() {
    convertBtn.disabled = true;
    convertBtn.textContent = t("pdf.convertingToImages");
    bulkGrid.innerHTML = "";

    var outMime = formatSelect.value;
    var quality = Number(qualityRange.value) / 100;
    var ext = outMime === "image/png" ? "png" : outMime === "image/webp" ? "webp" : "jpg";

    var zip = new JSZip();
    var totalBytes = 0;
    var usedNames = {};

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var res = await imageToBlob(item.img, outMime, quality);
      var blob = res.blob;
      if (!blob) continue;
      totalBytes += blob.size;

      var baseName = (item.file.name || "image-" + (i + 1)).replace(/\.[^.]+$/, "");
      var fileName = baseName + "." + ext;
      if (usedNames[fileName]) {
        fileName = baseName + "-" + (i + 1) + "." + ext;
      }
      usedNames[fileName] = true;
      zip.file(fileName, blob);

      var url = URL.createObjectURL(blob);
      var savedPct = Math.min(99, Math.round((1 - blob.size / item.file.size) * 100));

      var fig = document.createElement("figure");
      fig.innerHTML =
        '<img src="' + url + '" alt="" data-lightbox />' +
        "<figcaption><b>" +
        escapeHtml(fileName) +
        "</b>" +
        res.width +
        "×" +
        res.height +
        "px · " +
        formatBytes(blob.size) +
        (savedPct > 0
          ? ' · <span class="save">' + t("resize.savedPercent", { pct: savedPct }) + "</span>"
          : "") +
        "</figcaption>" +
        '<a class="page-download" href="' +
        url +
        '" download="' +
        fileName +
        '">' +
        t("common.downloadBtn") +
        "</a>";
      bulkGrid.appendChild(fig);
    }

    var zipBlob = await zip.generateAsync({ type: "blob" });
    var zipUrl = URL.createObjectURL(zipBlob);
    bulkZipBtn.href = zipUrl;
    bulkZipBtn.download = "converted-images.zip";
    bulkSummary.textContent = t("convert.bulkSummary", { count: items.length, size: formatBytes(totalBytes) });

    convertBtn.disabled = false;
    convertBtn.textContent = t("resize.convertBtn");

    bulkResult.classList.add("visible");
    bulkResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  convertBtn.addEventListener("click", function () {
    if (items.length > 1) {
      convertBulk();
    } else if (originalImage) {
      convertSingle();
    }
  });

  sendToUpscaleBtn.addEventListener("click", function () {
    if (!lastConvertedBlob) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        sessionStorage.setItem(
          "iorikim-handoff",
          JSON.stringify({ dataUrl: reader.result, name: lastConvertedName })
        );
      } catch (err) {
        console.error(err);
        alert(t("convert.sendToUpscaleFailAlert"));
      }
      window.location.href = "upscale.html";
    };
    reader.onerror = function () {
      alert(t("convert.sendToUpscaleFailAlert"));
      window.location.href = "upscale.html";
    };
    reader.readAsDataURL(lastConvertedBlob);
  });
})();
