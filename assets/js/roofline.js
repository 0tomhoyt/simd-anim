/* Interactive roofline: performance = min(peak, supply × intensity).
   Generic and parameterized — the sliders are the reader's own hardware;
   the plotted work shapes use the site's SVL 128/512 model only. */
(function () {
  "use strict";

  var root = document.querySelector("[data-roofline]");
  if (!root) return;

  var X_MIN = 0.125;
  var X_MAX = 16;
  var Y_MAX = 64;
  var PAD_L = 70;
  var PAD_R = 30;
  var PAD_T = 24;
  var PAD_B = 64;
  var W = 720;
  var H = 420;
  var PLOT_W = W - PAD_L - PAD_R;
  var PLOT_H = H - PAD_T - PAD_B;
  var LOG_X_MIN = Math.log2(X_MIN);
  var LOG_X_SPAN = Math.log2(X_MAX) - LOG_X_MIN;

  var WORK = [
    { key: "fmla", intensity: 0.25 },
    { key: "fmopa128", intensity: 1 },
    { key: "fmopa512", intensity: 4 }
  ];

  var peakSlider = root.querySelector("[data-slider='peak']");
  var supplySlider = root.querySelector("[data-slider='supply']");
  var peakOut = root.querySelector("[data-out='peak']");
  var supplyOut = root.querySelector("[data-out='supply']");
  var readout = root.querySelector("[data-readout]");
  var memoryRoof = root.querySelector("#roof-memory");
  var computeRoof = root.querySelector("#roof-compute");
  var ridge = root.querySelector("#ridge");
  var ridgeLine = root.querySelector("#ridge-line");
  var ridgeDot = root.querySelector("#ridge-dot");
  var ridgeText = root.querySelector("#ridge-text");

  function t(key) {
    return window.siteI18n && window.siteI18n.t ? window.siteI18n.t(key) : key;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function xPos(intensity) {
    var log = Math.log2(intensity);
    return PAD_L + ((log - LOG_X_MIN) / LOG_X_SPAN) * PLOT_W;
  }

  function yPos(perf) {
    return PAD_T + (1 - perf / Y_MAX) * PLOT_H;
  }

  function fmt(value) {
    return String(Math.round(value * 100) / 100);
  }

  function update() {
    var peak = +peakSlider.value;
    var supply = +supplySlider.value;
    if (peakOut) peakOut.textContent = String(peak);
    if (supplyOut) supplyOut.textContent = String(supply);

    /* Compute roof */
    var yPeak = yPos(peak);
    computeRoof.setAttribute("y1", yPeak);
    computeRoof.setAttribute("y2", yPeak);

    /* Memory roof: y = min(peak, supply × intensity), sampled in log-x */
    var samples = 90;
    var points = [];
    for (var s = 0; s <= samples; s++) {
      var intensity = Math.pow(2, LOG_X_MIN + (LOG_X_SPAN * s) / samples);
      var y = Math.min(peak, supply * intensity);
      points.push(xPos(intensity).toFixed(1) + "," + yPos(y).toFixed(1));
    }
    memoryRoof.setAttribute("points", points.join(" "));

    /* Ridge at peak ÷ supply */
    var ridgeIntensity = peak / supply;
    var ridgeVisible = ridgeIntensity >= X_MIN && ridgeIntensity <= X_MAX;
    ridge.style.display = ridgeVisible ? "" : "none";
    if (ridgeVisible) {
      var rx = xPos(ridgeIntensity);
      ridgeLine.setAttribute("x1", rx);
      ridgeLine.setAttribute("x2", rx);
      ridgeDot.setAttribute("cx", rx);
      ridgeDot.setAttribute("cy", yPeak);
      ridgeText.setAttribute("x", rx);
      ridgeText.setAttribute("y", yPeak);
    }

    /* Work dots and table */
    WORK.forEach(function (work) {
      var group = root.querySelector(".roof-dot[data-insn='" + work.key + "']");
      var memoryLimit = supply * work.intensity;
      var reachable = Math.min(peak, memoryLimit);
      var computeBound = memoryLimit >= peak;
      if (group) {
        var circle = group.querySelector("circle");
        var label = group.querySelector("text");
        circle.setAttribute("cx", xPos(work.intensity));
        circle.setAttribute("cy", yPos(reachable));
        label.setAttribute("x", xPos(work.intensity));
        label.setAttribute("y", yPos(reachable));
        group.classList.toggle("is-compute", computeBound);
      }
      var row = root.querySelector("tr[data-row='" + work.key + "']");
      if (row) {
        row.querySelector("[data-cell='reach']").textContent = fmt(reachable);
        row.querySelector("[data-cell='bound']").textContent = t(
          computeBound ? "roofline.boundCompute" : "roofline.boundMemory"
        );
      }
    });

    /* Readout */
    if (readout) {
      if (ridgeVisible) {
        readout.textContent = fill(t("roofline.readout"), { ridge: fmt(ridgeIntensity) });
      } else {
        readout.textContent = fill(t("roofline.readoutOff"), {
          ridge: fmt(ridgeIntensity),
          bound: t(ridgeIntensity > X_MAX ? "roofline.boundMemory" : "roofline.boundCompute")
        });
      }
    }

    updateProbe(peak, supply);
  }

  /* Clock probe: a fixed workload (512 FLOP at 0.5 FLOP/byte) timed two
     ways. Compute time scales with the clock; memory time does not. */
  var WORK_FLOPS = 512;
  var WORK_BYTES = 1024;
  var probe = document.querySelector("[data-probe]");
  var clockSlider = probe ? probe.querySelector("[data-slider='clock']") : null;
  var clockOut = probe ? probe.querySelector("[data-out='clock']") : null;
  var verdict = probe ? probe.querySelector("[data-verdict]") : null;

  function setBar(name, value, scale) {
    var fillEl = probe.querySelector("[data-bar='" + name + "']");
    var valueEl = probe.querySelector("[data-val='" + name + "']");
    var pct = scale > 0 ? Math.max(2, (value / scale) * 100) : 0;
    if (fillEl) fillEl.style.width = pct.toFixed(1) + "%";
    if (valueEl) valueEl.textContent = String(Math.round(value));
  }

  function updateProbe(peak, supply) {
    if (!probe) return;
    var f = clockSlider ? +clockSlider.value : 1;
    var computeTime = WORK_FLOPS / (peak * f);
    var memoryTime = WORK_BYTES / supply;
    var total = Math.max(computeTime, memoryTime);
    var scale = Math.max(computeTime, memoryTime);
    setBar("compute", computeTime, scale);
    setBar("memory", memoryTime, scale);
    setBar("total", total, scale);
    if (clockOut) clockOut.textContent = "×" + f;
    if (verdict) {
      verdict.textContent = t(memoryTime >= computeTime ? "roofline.verdictMemory" : "roofline.verdictCompute");
    }
  }

  [peakSlider, supplySlider].forEach(function (slider) {
    if (slider) slider.addEventListener("input", update);
  });
  if (clockSlider) {
    clockSlider.addEventListener("input", function () {
      updateProbe(+peakSlider.value, +supplySlider.value);
    });
  }

  update();
  document.addEventListener("site-lang", function () {
    update();
  });
})();
