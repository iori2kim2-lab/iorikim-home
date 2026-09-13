(function () {
  var MAX_INPUT_EDGE = 2000;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");
  var resizeNote = document.getElementById("resizeNote");
  var upscaleBtn = document.getElementById("upscaleBtn");
  var defaultBtnText = upscaleBtn.textContent;

  var beforeImg = document.getElementById("beforeImg");
  var afterImg = document.getElementById("afterImg");
  var beforeSize = document.getElementById("beforeSize");
  var afterSize = document.getElementById("afterSize");
  var beforeDims = document.getElementById("beforeDims");
  var afterDims = document.getElementById("afterDims");
  var downloadBtn = document.getElementById("downloadBtn");

  var originalFile = null;
  var originalImage = null;
  var upscalerInstance = null;

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

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        originalImage = img;
        beforeImg.src = e.target.result;
        beforeSize.textContent = formatBytes(file.size);
        beforeDims.textContent = img.naturalWidth + " × " + img.naturalHeight + "px";

        var longEdge = Math.max(img.naturalWidth, img.naturalHeight);
        if (longEdge > MAX_INPUT_EDGE) {
          var scale = MAX_INPUT_EDGE / longEdge;
          var w = Math.round(img.naturalWidth * scale);
          var h = Math.round(img.naturalHeight * scale);
          resizeNote.textContent =
            "원본이 커서 " + w + "×" + h + "px로 먼저 줄인 다음 2배로 업스케일해요.";
        } else {
          resizeNote.textContent =
            "업스케일 후 " + img.naturalWidth * 2 + "×" + img.naturalHeight * 2 + "px가 돼요.";
        }

        controls.style.display = "grid";
        result.classList.remove("visible");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function prepareSourceCanvas(img, maxEdge) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  upscaleBtn.addEventListener("click", async function () {
    if (!originalImage) return;
    upscaleBtn.disabled = true;
    upscaleBtn.textContent = "업스케일 중… (모델 로딩 포함 최대 1분)";

    try {
      var srcCanvas = prepareSourceCanvas(originalImage, MAX_INPUT_EDGE);

      if (!upscalerInstance) {
        upscalerInstance = new Upscaler({ model: DefaultUpscalerJSModel });
      }

      var resultSrc = await upscalerInstance.upscale(srcCanvas, {
        patchSize: 128,
        padding: 2,
      });

      var blob = await fetch(resultSrc).then(function (r) {
        return r.blob();
      });

      var url = URL.createObjectURL(blob);
      afterImg.src = url;
      afterSize.textContent = formatBytes(blob.size);
      afterDims.textContent = srcCanvas.width * 2 + " × " + srcCanvas.height * 2 + "px";

      var baseName = (originalFile.name || "image").replace(/\.[^.]+$/, "");
      downloadBtn.href = url;
      downloadBtn.download = baseName + "-upscaled-2x.png";

      result.classList.add("visible");
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      alert("업스케일에 실패했어요. 이미지 용량을 줄이거나 다른 브라우저에서 시도해보세요.");
    } finally {
      upscaleBtn.disabled = false;
      upscaleBtn.textContent = defaultBtnText;
    }
  });
})();
