(function () {
  var MAX_INPUT_EDGE = 2000;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");
  var resizeNote = document.getElementById("resizeNote");
  var upscaleBtn = document.getElementById("upscaleBtn");

  var beforeFigure = document.getElementById("beforeFigure");
  var afterFigure = document.getElementById("afterFigure");
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
      alert(t("common.imageOnlyAlert"));
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
          resizeNote.textContent = t("upscale.resizeNoteBig", { w: w, h: h });
        } else {
          resizeNote.textContent = t("upscale.resizeNoteNormal", {
            w: img.naturalWidth * 2,
            h: img.naturalHeight * 2,
          });
        }

        controls.style.display = "grid";
        afterFigure.hidden = true;
        downloadBtn.hidden = true;
        result.classList.add("visible");
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
    upscaleBtn.textContent = t("upscale.processingBtn");

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

      afterFigure.hidden = false;
      downloadBtn.hidden = false;
      afterFigure.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      alert(t("upscale.upscaleFailAlert"));
    } finally {
      upscaleBtn.disabled = false;
      upscaleBtn.textContent = t("upscale.upscaleBtn");
    }
  });

  // pick up an image handed off from another tool (e.g. the converter's
  // "upscale this image" button), if one is waiting
  if (window.IorikimHandoff) {
    IorikimHandoff.load()
      .then(function (data) {
        if (!data || !data.blob) return;
        var file = new File([data.blob], data.name || "image.png", { type: data.blob.type });
        handleFile(file);
      })
      .catch(function (err) {
        console.error(err);
      });
  }
})();
