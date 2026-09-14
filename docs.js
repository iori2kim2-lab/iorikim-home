(function () {
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // Renders an HTML fragment into a paginated PDF. jsPDF's own .html() places
  // real PDF text using its built-in font, which has no Hangul glyphs and
  // garbles Korean — so instead this rasterizes the fragment with html2canvas
  // (the browser's own fonts render Hangul fine) and slices that tall image
  // into A4-sized pages manually.
  function htmlToPdfBlob(innerHtml) {
    return new Promise(function (resolve, reject) {
      var PAGE_WIDTH_PX = 800;
      var container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:-99999px;top:0;width:" +
        PAGE_WIDTH_PX +
        "px;padding:32px;box-sizing:border-box;background:#fff;color:#111;" +
        "font-family:'Pretendard Variable',system-ui,sans-serif;font-size:15px;line-height:1.7;";
      container.innerHTML = innerHtml;
      document.body.appendChild(container);

      html2canvas(container, { backgroundColor: "#ffffff", scale: 2 })
        .then(function (canvas) {
          document.body.removeChild(container);

          var jsPDFCtor = window.jspdf.jsPDF;
          var doc = new jsPDFCtor({ unit: "pt", format: "a4", compress: true });
          var pageWidthPt = doc.internal.pageSize.getWidth();
          var pageHeightPt = doc.internal.pageSize.getHeight();

          var scaleFactor = pageWidthPt / canvas.width;
          var pageHeightPx = pageHeightPt / scaleFactor;

          var renderedHeight = 0;
          var first = true;
          while (renderedHeight < canvas.height) {
            var sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeight);
            var sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            sliceCanvas
              .getContext("2d")
              .drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            var imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
            if (!first) doc.addPage();
            doc.addImage(imgData, "JPEG", 0, 0, pageWidthPt, sliceHeightPx * scaleFactor);
            renderedHeight += sliceHeightPx;
            first = false;
          }

          resolve(doc.output("blob"));
        })
        .catch(function (err) {
          if (container.parentNode) document.body.removeChild(container);
          reject(err);
        });
    });
  }

  function download(url, filename) {
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- mode tabs ----
  var modeTabs = document.getElementById("docsModeTabs");
  var sections = {
    word: document.getElementById("wordSection"),
    excel: document.getElementById("excelSection"),
    text: document.getElementById("textSection"),
  };
  // Cross-tab file routing: a file dropped on the wrong tab gets handed to
  // the right one instead of just showing an alert. Populated once each
  // section's IIFE below defines its own handleFile.
  var handlers = {};

  function switchMode(mode) {
    modeTabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    Object.keys(sections).forEach(function (key) {
      sections[key].style.display = key === mode ? "" : "none";
    });
  }

  modeTabs.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    switchMode(btn.dataset.mode);
  });

  // ==================== Word -> PDF ====================
  (function () {
    var dropzone = document.getElementById("wordDropzone");
    var fileInput = document.getElementById("wordFileInput");
    var controls = document.getElementById("wordControls");
    var fileInfo = document.getElementById("wordFileInfo");
    var convertBtn = document.getElementById("wordConvertBtn");
    var result = document.getElementById("wordResult");
    var summary = document.getElementById("wordSummary");
    var downloadBtn = document.getElementById("wordDownloadBtn");

    var currentFile = null;
    var currentHtml = "";

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
      fileInput.value = "";
    });

    async function handleFile(file) {
      var name = (file.name || "").toLowerCase();
      if (!name.endsWith(".docx")) {
        if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
          switchMode("excel");
          handlers.excel(file);
          return;
        }
        alert(t("docs.wordOnlyAlert"));
        return;
      }
      currentFile = file;
      fileInfo.textContent = t("common.loading");
      controls.style.display = "grid";
      result.classList.remove("visible");
      downloadBtn.hidden = true;

      try {
        var buffer = await file.arrayBuffer();
        var res = await mammoth.convertToHtml({ arrayBuffer: buffer });
        currentHtml = res.value;
        fileInfo.textContent = file.name + " · " + formatBytes(file.size);
      } catch (err) {
        console.error(err);
        alert(t("docs.wordReadFailAlert"));
        currentFile = null;
      }
    }

    convertBtn.addEventListener("click", async function () {
      if (!currentFile || !currentHtml) return;
      convertBtn.disabled = true;
      convertBtn.textContent = t("docs.generatingPdf");

      try {
        var blob = await htmlToPdfBlob(currentHtml);
        var url = URL.createObjectURL(blob);
        var baseName = (currentFile.name || "document").replace(/\.[^.]+$/, "");
        downloadBtn.href = url;
        downloadBtn.download = baseName + ".pdf";
        downloadBtn.hidden = false;
        summary.textContent = t("docs.pdfSummary", { size: formatBytes(blob.size) });
        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err) {
        console.error(err);
        alert(t("docs.wordConvertFailAlert"));
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = t("docs.convertToPdfBtn");
      }
    });

    handlers.word = handleFile;
  })();

  // ==================== Excel <-> CSV ====================
  (function () {
    var dropzone = document.getElementById("excelDropzone");
    var fileInput = document.getElementById("excelFileInput");
    var controls = document.getElementById("excelControls");
    var fileInfo = document.getElementById("excelFileInfo");
    var convertBtn = document.getElementById("excelConvertBtn");
    var pdfBtn = document.getElementById("excelPdfBtn");
    var result = document.getElementById("excelResult");
    var summary = document.getElementById("excelSummary");
    var downloadBtn = document.getElementById("excelDownloadBtn");

    var currentFile = null;
    var direction = null; // "toCsv" | "toXlsx"

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
      fileInput.value = "";
    });

    function handleFile(file) {
      var name = (file.name || "").toLowerCase();
      var isCsv = name.endsWith(".csv");
      var isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
      if (!isCsv && !isExcel) {
        if (name.endsWith(".docx")) {
          switchMode("word");
          handlers.word(file);
          return;
        }
        alert(t("docs.excelOnlyAlert"));
        return;
      }
      currentFile = file;
      direction = isCsv ? "toXlsx" : "toCsv";
      fileInfo.textContent = file.name + " · " + formatBytes(file.size);
      controls.style.display = "grid";
      result.classList.remove("visible");
      downloadBtn.hidden = true;
      convertBtn.textContent = isCsv ? t("docs.excelConvertToXlsxBtn") : t("docs.excelConvertToCsvBtn");
    }

    convertBtn.addEventListener("click", async function () {
      if (!currentFile) return;
      convertBtn.disabled = true;
      convertBtn.textContent = t("docs.converting");

      try {
        var baseName = (currentFile.name || "sheet").replace(/\.[^.]+$/, "");
        var blob, outName;

        if (direction === "toCsv") {
          var buffer = await currentFile.arrayBuffer();
          var wb = XLSX.read(buffer, { type: "array" });
          var firstSheetName = wb.SheetNames[0];
          var sheet = wb.Sheets[firstSheetName];
          var csv = XLSX.utils.sheet_to_csv(sheet);
          blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
          outName = baseName + ".csv";
        } else {
          var text = await currentFile.text();
          var wbFromCsv = XLSX.read(text, { type: "string" });
          var rows = wbFromCsv.Sheets[wbFromCsv.SheetNames[0]];
          var wbOut = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wbOut, rows, "Sheet1");
          var arrayBufferOut = XLSX.write(wbOut, { type: "array", bookType: "xlsx" });
          blob = new Blob([arrayBufferOut], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          outName = baseName + ".xlsx";
        }

        var url = URL.createObjectURL(blob);
        downloadBtn.href = url;
        downloadBtn.download = outName;
        downloadBtn.hidden = false;
        summary.textContent = t("docs.excelSummary", { name: outName, size: formatBytes(blob.size) });
        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err) {
        console.error(err);
        alert(t("docs.excelConvertFailAlert"));
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = direction === "toXlsx" ? t("docs.excelConvertToXlsxBtn") : t("docs.excelConvertToCsvBtn");
      }
    });

    // Reads the current file into a workbook regardless of source format
    // (csv text vs. xlsx/xls binary) and returns its first sheet.
    async function readFirstSheet() {
      var name = (currentFile.name || "").toLowerCase();
      var wb;
      if (name.endsWith(".csv")) {
        wb = XLSX.read(await currentFile.text(), { type: "string" });
      } else {
        wb = XLSX.read(await currentFile.arrayBuffer(), { type: "array" });
      }
      return wb.Sheets[wb.SheetNames[0]];
    }

    pdfBtn.addEventListener("click", async function () {
      if (!currentFile) return;
      pdfBtn.disabled = true;
      pdfBtn.textContent = t("docs.generatingPdf");

      try {
        var sheet = await readFirstSheet();
        var tableHtml =
          "<style>table{border-collapse:collapse;width:100%;font-size:12px}" +
          "td,th{border:1px solid #ccc;padding:5px 9px;text-align:left}</style>" +
          XLSX.utils.sheet_to_html(sheet, { editable: false });

        var blob = await htmlToPdfBlob(tableHtml);
        var url = URL.createObjectURL(blob);
        var baseName = (currentFile.name || "sheet").replace(/\.[^.]+$/, "");
        downloadBtn.href = url;
        downloadBtn.download = baseName + ".pdf";
        downloadBtn.hidden = false;
        summary.textContent = t("docs.excelSummary", { name: baseName + ".pdf", size: formatBytes(blob.size) });
        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err) {
        console.error(err);
        alert(t("docs.excelPdfFailAlert"));
      } finally {
        pdfBtn.disabled = false;
        pdfBtn.textContent = t("docs.excelPdfBtn");
      }
    });

    handlers.excel = handleFile;
  })();

  // ==================== Text -> PDF ====================
  (function () {
    var textInput = document.getElementById("textInput");
    var fileBtn = document.getElementById("textFileBtn");
    var fileInput = document.getElementById("textFileInput");
    var convertBtn = document.getElementById("textConvertBtn");
    var result = document.getElementById("textResult");
    var summary = document.getElementById("textSummary");
    var downloadBtn = document.getElementById("textDownloadBtn");

    fileBtn.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", async function () {
      var file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        textInput.value = await file.text();
      } catch (err) {
        console.error(err);
        alert(t("docs.textReadFailAlert"));
      }
    });

    // Plain text has no blank-line paragraphs, so `breaks:true` makes every
    // single newline a visible line break — matching the old pre-wrap look
    // for non-markdown input while still parsing real markdown syntax.
    if (window.marked) marked.setOptions({ breaks: true, gfm: true });

    var MD_CSS =
      "<style>.md-body h1,.md-body h2,.md-body h3{margin:.6em 0 .3em;line-height:1.3}" +
      ".md-body h1{font-size:1.6em}.md-body h2{font-size:1.35em}.md-body h3{font-size:1.15em}" +
      ".md-body p{margin:.5em 0}.md-body ul,.md-body ol{margin:.4em 0;padding-left:1.4em}" +
      ".md-body li{margin:.2em 0}.md-body blockquote{margin:.6em 0;padding:.2em 1em;border-left:3px solid #ddd;color:#555}" +
      ".md-body code{background:#f2f2f2;padding:.1em .35em;border-radius:4px;font-size:.92em}" +
      ".md-body pre{background:#f2f2f2;padding:10px 12px;border-radius:6px;overflow:auto}" +
      ".md-body pre code{background:none;padding:0}" +
      ".md-body a{color:#6d5bff}.md-body hr{border:none;border-top:1px solid #ddd;margin:1em 0}" +
      ".md-body table{border-collapse:collapse;margin:.5em 0}.md-body td,.md-body th{border:1px solid #ccc;padding:4px 8px}</style>";

    function renderMarkdown(text) {
      var body = window.marked
        ? marked.parse(text)
        : "<pre style=\"white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;\">" + escapeHtml(text) + "</pre>";
      return MD_CSS + '<div class="md-body">' + body + "</div>";
    }

    convertBtn.addEventListener("click", async function () {
      var text = textInput.value;
      if (!text.trim()) return;
      convertBtn.disabled = true;
      convertBtn.textContent = t("docs.generatingPdf");

      try {
        var html = renderMarkdown(text);
        var blob = await htmlToPdfBlob(html);
        var url = URL.createObjectURL(blob);
        downloadBtn.href = url;
        downloadBtn.download = "text.pdf";
        downloadBtn.hidden = false;
        summary.textContent = t("docs.pdfSummary", { size: formatBytes(blob.size) });
        result.classList.add("visible");
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err) {
        console.error(err);
        alert(t("docs.textConvertFailAlert"));
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = t("docs.convertToPdfBtn");
      }
    });
  })();
})();
