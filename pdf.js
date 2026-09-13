(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var controls = document.getElementById("controls");
  var result = document.getElementById("result");

  var fileList = document.getElementById("fileList");
  var fileListLabel = document.getElementById("fileListLabel");
  var pageSizeSelect = document.getElementById("pageSizeSelect");
  var makePdfBtn = document.getElementById("makePdfBtn");

  var pdfSummary = document.getElementById("pdfSummary");
  var downloadBtn = document.getElementById("downloadBtn");

  var items = [];

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
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener("change", function () {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });

  async function handleFiles(fileListInput) {
    var files = Array.from(fileListInput || []).filter(function (f) {
      return f.type.startsWith("image/") || isHeic(f);
    });
    if (!files.length) return;

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
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
        items.push({
          file: file,
          img: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch (err) {
        console.error(err);
      }
    }

    renderFileList();
    controls.style.display = items.length ? "grid" : "none";
    result.classList.remove("visible");
  }

  function renderFileList() {
    fileListLabel.textContent = t("pdf.fileListLabel", { count: items.length });
    fileList.innerHTML = "";

    items.forEach(function (item, index) {
      var row = document.createElement("div");
      row.className = "file-item";

      var img = document.createElement("img");
      img.src = item.img.src;
      img.alt = "";

      var name = document.createElement("span");
      name.className = "file-name";
      name.textContent = item.file.name || index + 1;

      var actions = document.createElement("div");
      actions.className = "file-actions";

      var upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.textContent = "↑";
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", function () {
        moveItem(index, -1);
      });

      var downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.textContent = "↓";
      downBtn.disabled = index === items.length - 1;
      downBtn.addEventListener("click", function () {
        moveItem(index, 1);
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () {
        items.splice(index, 1);
        renderFileList();
        controls.style.display = items.length ? "grid" : "none";
        result.classList.remove("visible");
      });

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(removeBtn);

      row.appendChild(img);
      row.appendChild(name);
      row.appendChild(actions);
      fileList.appendChild(row);
    });
  }

  function moveItem(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= items.length) return;
    var tmp = items[index];
    items[index] = items[target];
    items[target] = tmp;
    renderFileList();
  }

  function imageToJpegDataUrl(img) {
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  makePdfBtn.addEventListener("click", async function () {
    if (!items.length) return;
    makePdfBtn.disabled = true;
    makePdfBtn.textContent = t("pdf.generatingPdf");

    try {
      var jsPDFCtor = window.jspdf.jsPDF;
      var mode = pageSizeSelect.value;
      var doc;

      if (mode === "fit") {
        doc = new jsPDFCtor({
          unit: "px",
          format: [items[0].width, items[0].height],
          compress: true,
        });
      } else {
        doc = new jsPDFCtor({ unit: "mm", format: mode, compress: true });
      }

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (i > 0) {
          if (mode === "fit") {
            doc.addPage([item.width, item.height]);
          } else {
            doc.addPage(mode);
          }
        }

        var jpegDataUrl = imageToJpegDataUrl(item.img);

        if (mode === "fit") {
          doc.addImage(jpegDataUrl, "JPEG", 0, 0, item.width, item.height);
        } else {
          var pageW = doc.internal.pageSize.getWidth();
          var pageH = doc.internal.pageSize.getHeight();
          var margin = 10;
          var maxW = pageW - margin * 2;
          var maxH = pageH - margin * 2;
          var aspect = item.width / item.height;
          var drawW = maxW;
          var drawH = drawW / aspect;
          if (drawH > maxH) {
            drawH = maxH;
            drawW = drawH * aspect;
          }
          var x = (pageW - drawW) / 2;
          var y = (pageH - drawH) / 2;
          doc.addImage(jpegDataUrl, "JPEG", x, y, drawW, drawH);
        }
      }

      var blob = doc.output("blob");
      var url = URL.createObjectURL(blob);
      pdfSummary.textContent = t("pdf.summary", { count: items.length, size: formatBytes(blob.size) });
      downloadBtn.href = url;
      downloadBtn.download = "images.pdf";

      result.classList.add("visible");
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      alert(t("pdf.pdfFailAlert"));
    } finally {
      makePdfBtn.disabled = false;
      makePdfBtn.textContent = t("pdf.makePdfBtn");
    }
  });

  document.addEventListener("langchange", function () {
    if (items.length) renderFileList();
  });
})();
