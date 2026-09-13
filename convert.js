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

  var beforeImg = document.getElementById("beforeImg");
  var afterImg = document.getElementById("afterImg");
  var beforeSize = document.getElementById("beforeSize");
  var afterSize = document.getElementById("afterSize");
  var beforeDims = document.getElementById("beforeDims");
  var afterDims = document.getElementById("afterDims");
  var saveStat = document.getElementById("saveStat");
  var downloadBtn = document.getElementById("downloadBtn");

  var dropzoneTitle = dropzone.querySelector("strong");
  var defaultDropzoneTitle = dropzoneTitle.textContent;

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

  function detectFormatLabel(file) {
    if (isHeic(file)) return "HEIC";
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
    var looksLikeImage = file.type.startsWith("image/") || isHeic(file);
    if (!looksLikeImage) {
      alert("이미지 파일만 지원해요.");
      return;
    }

    originalFile = file;
    dropzoneTitle.textContent = isHeic(file) ? "HEIC 디코딩 중…" : "불러오는 중…";

    try {
      var dataUrl;
      if (isHeic(file)) {
        var convertedBlob = await heic2any({ blob: file, toType: "image/png" });
        if (Array.isArray(convertedBlob)) convertedBlob = convertedBlob[0];
        dataUrl = await blobToDataUrl(convertedBlob);
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
      result.classList.remove("visible");
      updateQualityVisibility();
    } catch (err) {
      alert("이미지를 불러오지 못했어요. 다른 파일로 시도해보세요.");
    } finally {
      dropzoneTitle.textContent = defaultDropzoneTitle;
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
          alert("변환에 실패했어요. 다른 형식으로 시도해보세요.");
          return;
        }
        var url = URL.createObjectURL(blob);
        afterImg.src = url;
        afterSize.textContent = formatBytes(blob.size);
        afterDims.textContent = canvas.width + " × " + canvas.height + "px";

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
        downloadBtn.download = baseName + "." + ext;

        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      outMime,
      quality
    );
  });
})();
