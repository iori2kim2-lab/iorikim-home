(function () {
  // qrcode-generator's default byte mode truncates each char code to a
  // single byte (charCodeAt & 0xff), which silently mangles any non-ASCII
  // text (Korean, Japanese, emoji, ...). Switch it to proper UTF-8 bytes.
  if (window.qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  }

  var modeTabs = document.getElementById("qrModeTabs");
  var sections = {
    text: document.getElementById("textSection"),
    wifi: document.getElementById("wifiSection"),
  };
  var mode = "text";

  modeTabs.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    mode = btn.dataset.mode;
    modeTabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    Object.keys(sections).forEach(function (key) {
      sections[key].style.display = key === mode ? "" : "none";
    });
    scheduleRender();
  });

  var textInput = document.getElementById("qrTextInput");
  var wifiSsid = document.getElementById("wifiSsid");
  var wifiPassword = document.getElementById("wifiPassword");
  var wifiSecurity = document.getElementById("wifiSecurity");
  var wifiHidden = document.getElementById("wifiHidden");
  var sizeSelect = document.getElementById("qrSize");
  var levelSelect = document.getElementById("qrLevel");
  var preview = document.getElementById("qrPreview");
  var emptyHint = document.getElementById("qrEmptyHint");
  var downloadRow = document.getElementById("qrDownloadRow");
  var pngBtn = document.getElementById("qrPngBtn");
  var svgBtn = document.getElementById("qrSvgBtn");

  [textInput, wifiSsid, wifiPassword, wifiSecurity, wifiHidden, sizeSelect, levelSelect].forEach(function (el) {
    el.addEventListener("input", scheduleRender);
    el.addEventListener("change", scheduleRender);
  });

  // Wi-Fi QR payload spec requires \, ;, ,, and : inside field values to be escaped.
  function escapeWifiField(str) {
    return String(str).replace(/([\\;,:"])/g, "\\$1");
  }

  function buildContent() {
    if (mode === "wifi") {
      var ssid = wifiSsid.value.trim();
      if (!ssid) return "";
      var security = wifiSecurity.value;
      var passPart = security === "nopass" ? "" : "P:" + escapeWifiField(wifiPassword.value) + ";";
      return (
        "WIFI:T:" + security + ";S:" + escapeWifiField(ssid) + ";" + passPart +
        "H:" + (wifiHidden.checked ? "true" : "false") + ";;"
      );
    }
    return textInput.value.trim();
  }

  function svgToPngDataUrl(svgMarkup, pxSize) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgMarkup], { type: "image/svg+xml" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = pxSize;
        canvas.height = pxSize;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, pxSize, pxSize);
        ctx.drawImage(img, 0, 0, pxSize, pxSize);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("svg rasterize failed"));
      };
      img.src = url;
    });
  }

  var renderTimer = null;
  var renderSeq = 0;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 250);
  }

  async function render() {
    var seq = ++renderSeq;
    var content = buildContent();

    if (!content) {
      preview.innerHTML = "";
      emptyHint.hidden = false;
      emptyHint.textContent = t("qr.emptyHint");
      downloadRow.hidden = true;
      return;
    }

    try {
      var qr = qrcode(0, levelSelect.value);
      qr.addData(content);
      qr.make();

      var moduleCount = qr.getModuleCount();
      var margin = 4;
      var targetSize = parseInt(sizeSelect.value, 10);
      var cellSize = Math.max(1, Math.floor(targetSize / (moduleCount + margin * 2)));
      var finalPx = (moduleCount + margin * 2) * cellSize;

      // live preview: no fixed width/height so CSS controls the on-screen size
      preview.innerHTML = qr.createSvgTag({ cellSize: cellSize, margin: margin, scalable: true });

      // download assets: fixed pixel size, generated off the same module data
      var svgFixed = qr.createSvgTag(cellSize, margin);
      var pngDataUrl = await svgToPngDataUrl(svgFixed, finalPx);
      if (seq !== renderSeq) return; // a newer render started while we awaited

      pngBtn.href = pngDataUrl;
      pngBtn.download = "qrcode.png";

      var svgBlob = new Blob([svgFixed], { type: "image/svg+xml" });
      if (svgBtn.href && svgBtn.href.indexOf("blob:") === 0) URL.revokeObjectURL(svgBtn.href);
      svgBtn.href = URL.createObjectURL(svgBlob);
      svgBtn.download = "qrcode.svg";

      emptyHint.hidden = true;
      downloadRow.hidden = false;
    } catch (err) {
      console.error(err);
      preview.innerHTML = "";
      emptyHint.hidden = false;
      emptyHint.textContent = t("qr.tooLongAlert");
      downloadRow.hidden = true;
    }
  }

  render();
})();
