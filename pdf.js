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

  // ---- mode tabs (이미지 → PDF / PDF → 이미지) ----
  var pdfModeTabs = document.getElementById("pdfModeTabs");
  var img2pdfSection = document.getElementById("img2pdfSection");
  var pdf2imgSection = document.getElementById("pdf2imgSection");

  function switchPdfMode(mode) {
    pdfModeTabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    img2pdfSection.style.display = mode === "img2pdf" ? "" : "none";
    pdf2imgSection.style.display = mode === "pdf2img" ? "" : "none";
  }

  pdfModeTabs.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    switchPdfMode(btn.dataset.mode);
  });

  // ---- PDF → images ----
  var pdfDropzone = document.getElementById("pdfDropzone");
  var pdfFileInput = document.getElementById("pdfFileInput");
  var pdf2imgControls = document.getElementById("pdf2imgControls");
  var pdfInfo = document.getElementById("pdfInfo");
  var pdf2imgFormatSelect = document.getElementById("pdf2imgFormatSelect");
  var pdf2imgQualityField = document.getElementById("pdf2imgQualityField");
  var pdf2imgQualityRange = document.getElementById("pdf2imgQualityRange");
  var pdf2imgQualityValue = document.getElementById("pdf2imgQualityValue");
  var pdf2imgScaleSelect = document.getElementById("pdf2imgScaleSelect");
  var pdf2imgBtn = document.getElementById("pdf2imgBtn");
  var pdf2imgResult = document.getElementById("pdf2imgResult");
  var pdf2imgSummary = document.getElementById("pdf2imgSummary");
  var pdf2imgGrid = document.getElementById("pdf2imgGrid");
  var pdf2imgZipBtn = document.getElementById("pdf2imgZipBtn");

  var pdf2wordBtn = document.getElementById("pdf2wordBtn");
  var pdf2wordResult = document.getElementById("pdf2wordResult");
  var pdf2wordSummary = document.getElementById("pdf2wordSummary");
  var pdf2wordDownloadBtn = document.getElementById("pdf2wordDownloadBtn");

  var pdfDoc = null;
  var pdfFileName = "document";

  var pdfjsModulePromise = null;
  function loadPdfjs() {
    if (!pdfjsModulePromise) {
      pdfjsModulePromise = import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs").then(
        function (mod) {
          // The worker must be same-origin: browsers refuse to construct a
          // Worker from a cross-origin script URL, so it's self-hosted here.
          mod.GlobalWorkerOptions.workerSrc = "pdf.worker.min.mjs";
          return mod;
        }
      );
    }
    return pdfjsModulePromise;
  }

  pdfDropzone.addEventListener("click", function () {
    pdfFileInput.click();
  });

  ["dragover", "dragenter"].forEach(function (evt) {
    pdfDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      pdfDropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(function (evt) {
    pdfDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      pdfDropzone.classList.remove("dragover");
    });
  });

  pdfDropzone.addEventListener("drop", function (e) {
    var file = e.dataTransfer.files[0];
    if (file) handlePdfFile(file);
  });

  pdfFileInput.addEventListener("change", function () {
    if (pdfFileInput.files[0]) handlePdfFile(pdfFileInput.files[0]);
    pdfFileInput.value = "";
  });

  var pdfDropzoneTitle = pdfDropzone.querySelector("strong");

  async function handlePdfFile(file) {
    var name = (file.name || "").toLowerCase();
    var isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    if (!isPdf) {
      alert(t("pdf.pdfOnlyAlert"));
      return;
    }

    pdfFileName = (file.name || "document").replace(/\.[^.]+$/, "");
    pdfDropzoneTitle.textContent = t("common.loading");
    pdf2imgResult.classList.remove("visible");
    pdf2wordResult.classList.remove("visible");

    try {
      var pdfjsLib = await loadPdfjs();
      var buffer = await file.arrayBuffer();
      var loadingTask = pdfjsLib.getDocument({ data: buffer });
      pdfDoc = await loadingTask.promise;

      pdfInfo.textContent = t("pdf.pdfPageCount", { count: pdfDoc.numPages, name: file.name });
      pdf2imgControls.style.display = "grid";
    } catch (err) {
      console.error(err);
      alert(t("pdf.pdfLoadFailAlert"));
      pdfDoc = null;
    } finally {
      pdfDropzoneTitle.textContent = t("pdf.pdfDropzoneDefault");
    }
  }

  function updatePdf2imgQualityVisibility() {
    pdf2imgQualityField.style.display = pdf2imgFormatSelect.value === "image/png" ? "none" : "grid";
  }
  pdf2imgFormatSelect.addEventListener("change", updatePdf2imgQualityVisibility);
  pdf2imgQualityRange.addEventListener("input", function () {
    pdf2imgQualityValue.textContent = pdf2imgQualityRange.value;
  });

  // Renders one PDF page to a canvas at the given scale, filling a white
  // background first when exporting as JPEG (which has no transparency).
  async function renderPageToCanvas(page, scale, mime) {
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    var ctx = canvas.getContext("2d");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return canvas;
  }

  pdf2imgBtn.addEventListener("click", async function () {
    if (!pdfDoc) return;
    pdf2imgBtn.disabled = true;
    pdf2imgBtn.textContent = t("pdf.convertingToImages");
    pdf2imgGrid.innerHTML = "";

    try {
      var pdfjsLib = await loadPdfjs();
      var scale = Number(pdf2imgScaleSelect.value) || 2;
      var mime = pdf2imgFormatSelect.value;
      var quality = Number(pdf2imgQualityRange.value) / 100;
      var ext = mime === "image/png" ? "png" : "jpg";

      var zip = new JSZip();
      var totalBytes = 0;

      for (var i = 1; i <= pdfDoc.numPages; i++) {
        var page = await pdfDoc.getPage(i);
        var canvas = await renderPageToCanvas(page, scale, mime);

        var blob = await new Promise(function (resolve) {
          canvas.toBlob(resolve, mime, quality);
        });
        if (!blob) continue;
        totalBytes += blob.size;

        var pageFileName = pdfFileName + "-p" + String(i).padStart(2, "0") + "." + ext;
        zip.file(pageFileName, blob);

        var url = URL.createObjectURL(blob);
        var fig = document.createElement("figure");
        fig.innerHTML =
          '<img src="' + url + '" alt="page ' + i + '" data-lightbox />' +
          "<figcaption><b>" +
          t("pdf.pageLabel", { n: i }) +
          "</b>" +
          canvas.width +
          "×" +
          canvas.height +
          "px · " +
          formatBytes(blob.size) +
          "</figcaption>" +
          '<a class="page-download" href="' +
          url +
          '" download="' +
          pageFileName +
          '">' +
          t("common.downloadBtn") +
          "</a>";
        pdf2imgGrid.appendChild(fig);
      }

      var zipBlob = await zip.generateAsync({ type: "blob" });
      var zipUrl = URL.createObjectURL(zipBlob);
      pdf2imgZipBtn.href = zipUrl;
      pdf2imgZipBtn.download = pdfFileName + "-images.zip";
      pdf2imgSummary.textContent = t("pdf.imagesSummary", {
        count: pdfDoc.numPages,
        size: formatBytes(zipBlob.size),
      });

      pdf2wordResult.classList.remove("visible");
      pdf2imgResult.classList.add("visible");
      pdf2imgResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      alert(t("pdf.pdf2imgFailAlert"));
    } finally {
      pdf2imgBtn.disabled = false;
      pdf2imgBtn.textContent = t("pdf.pdf2imgBtn");
    }
  });

  // Word doesn't lay out pages at 96 CSS px/in like a browser does, but this
  // is the same reference DPI the docx library assumes for image sizing, so
  // treating "px" that way keeps the page reliably inside the printable area.
  var WORD_PAGE_PX = 620;

  pdf2wordBtn.addEventListener("click", async function () {
    if (!pdfDoc) return;
    pdf2wordBtn.disabled = true;
    pdf2wordBtn.textContent = t("pdf.convertingToWord");

    try {
      var scale = Number(pdf2imgScaleSelect.value) || 2;
      var mime = pdf2imgFormatSelect.value;
      var quality = Number(pdf2imgQualityRange.value) / 100;
      var imgType = mime === "image/png" ? "png" : "jpg";

      var children = [];

      for (var i = 1; i <= pdfDoc.numPages; i++) {
        var page = await pdfDoc.getPage(i);
        var canvas = await renderPageToCanvas(page, scale, mime);

        var blob = await new Promise(function (resolve) {
          canvas.toBlob(resolve, mime, quality);
        });
        if (!blob) continue;

        var dispW = WORD_PAGE_PX;
        var dispH = Math.round(canvas.height * (dispW / canvas.width));

        children.push(
          new docx.Paragraph({
            pageBreakBefore: i > 1,
            children: [
              new docx.ImageRun({
                data: await blob.arrayBuffer(),
                type: imgType,
                transformation: { width: dispW, height: dispH },
              }),
            ],
          })
        );
      }

      var doc = new docx.Document({ sections: [{ children: children }] });
      var docxBlob = await docx.Packer.toBlob(doc);

      var url = URL.createObjectURL(docxBlob);
      pdf2wordDownloadBtn.href = url;
      pdf2wordDownloadBtn.download = pdfFileName + ".docx";
      pdf2wordSummary.textContent = t("pdf.wordSummary", {
        count: pdfDoc.numPages,
        size: formatBytes(docxBlob.size),
      });

      pdf2imgResult.classList.remove("visible");
      pdf2wordResult.classList.add("visible");
      pdf2wordResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      alert(t("pdf.pdf2wordFailAlert"));
    } finally {
      pdf2wordBtn.disabled = false;
      pdf2wordBtn.textContent = t("pdf.pdf2wordBtn");
    }
  });

  // pick up a PDF handed off from another tool (e.g. the docs converter's
  // Word tab, when someone drops a .pdf there by mistake), if one is waiting
  if (window.IorikimHandoff) {
    IorikimHandoff.load()
      .then(function (data) {
        if (!data || !data.blob) return;
        switchPdfMode("pdf2img");
        var file = new File([data.blob], data.name || "document.pdf", { type: "application/pdf" });
        handlePdfFile(file);
      })
      .catch(function (err) {
        console.error(err);
      });
  }
})();
