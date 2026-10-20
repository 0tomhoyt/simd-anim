/* Interactive roofline: performance = min(peak, supply × intensity).
   Generic and parameterized — the sliders are the reader's own hardware;
   the plotted work shapes use the site's SVL 128/512 model only. */
(function () {
  "use strict";

  var root = document.querySelector("[data-roofline]");
  if (!root) return;

  var X_MIN = 0.125;
  /* The window reaches 64 so the bench's measured points fit: a size-N FP64
     GEMM lands at the naive intensity N/12, so the sweep 48…768 spans 4…64. */
  var X_MAX = 64;
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

  /* The sliders are per-cycle rates; datasheets quote per-second numbers. One
     illustrative clock ties the two together — keep it in step with the
     {clock} value that the roofline.units string quotes. */
  var CLOCK_GHZ = 2;

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
    var decimals = Math.abs(value) < 1 ? 3 : 2;
    var factor = Math.pow(10, decimals);
    return String(Math.round(value * factor) / factor);
  }

  /* Unit bridge: GFLOP/s = peak × clock, GB/s = supply × clock. */
  var unitsLine = root.querySelector("[data-units]");

  function updateUnits(peak, supply) {
    if (!unitsLine) return;
    unitsLine.textContent = fill(t("roofline.units"), {
      clock: fmt(CLOCK_GHZ),
      peak: fmt(peak),
      supply: fmt(supply),
      gflops: fmt(peak * CLOCK_GHZ),
      gbps: fmt(supply * CLOCK_GHZ)
    });
  }

  /* X tick labels are generated from xPos() so they can never drift from the
     roof, the ridge or the dots. Same markup as the static y-axis labels. */
  (function buildXTicks() {
    var grid = root.querySelector(".grid");
    if (!grid) return;
    for (var intensity = X_MIN; intensity <= X_MAX; intensity *= 2) {
      var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", xPos(intensity).toFixed(1));
      label.setAttribute("y", "372");
      label.setAttribute("text-anchor", "middle");
      label.textContent = String(intensity);
      grid.appendChild(label);
    }
  })();

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

    updateUnits(peak, supply);
    updateProbe(peak, supply);
    updateMeasured();
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

  /* The visitor's own cores, measured by the site bench (bench-core.js is
     included before this file). Scalar FP64 points sit at the naive GEMM
     intensity N/12; the FP32 SIMD points at N/6, because half-width data
     doubles FLOP per byte. The y value uses the same per-cycle conversion as
     the roofs, so measured and hypothetical share one axis honestly. A
     browser's scalar JavaScript is never a machine's peak — these are
     reference points, never slider values. */
  var NAIVE_AI_FP64 = 12;
  var NAIVE_AI_FP32 = 6;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var measured = readMeasuredData();
  var measuredGroup = root.querySelector("#roof-measured");
  var measuredLine = root.querySelector("#roof-measured-line");
  var measuredDots = root.querySelector("#roof-measured-dots");
  var measuredLabel = root.querySelector("#roof-measured-label");
  var simdGroup = root.querySelector("#roof-simd");
  var simdDots = root.querySelector("#roof-simd-dots");
  var simdLabel = root.querySelector("#roof-simd-label");
  var measuredNote = document.querySelector("[data-measured-note]");
  var simdNote = document.querySelector("[data-simd-note]");
  var sweepNote = document.querySelector("[data-sweep-note]");
  var measuredPrompt = document.querySelector("[data-measured-prompt]");
  var runBtn = document.querySelector("[data-bench-run]");
  var statusLine = document.querySelector("[data-bench-status]");

  function readMeasuredData() {
    return window.siteBench && window.siteBench.readStored ? window.siteBench.readStored() : null;
  }

  function clearDots(group) {
    while (group && group.firstChild) group.removeChild(group.firstChild);
  }

  function dot(parent, cx, cy, cls, r) {
    var c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", cx.toFixed(1));
    c.setAttribute("cy", cy.toFixed(1));
    c.setAttribute("r", String(r));
    c.setAttribute("class", cls);
    parent.appendChild(c);
  }

  function gflopsText(g) {
    return String(g >= 10 ? Math.round(g) : Math.round(g * 10) / 10);
  }

  function updateMeasured() {
    if (!measuredGroup) return;
    clearDots(measuredDots);
    clearDots(simdDots);

    /* scalar sweep: a dashed ride along the roofs that sags past the cache */
    var scalar = measured && measured.scalar;
    var show = !!(measured && measured.ok && scalar && scalar.length);
    var lastY = null;
    if (show) {
      var pts = [];
      scalar.forEach(function (p) {
        var perCycle = p.gflops / CLOCK_GHZ;
        if (!(perCycle > 0) || perCycle >= Y_MAX) return;
        var x = xPos(p.n / NAIVE_AI_FP64);
        var y = yPos(perCycle);
        pts.push(x.toFixed(1) + "," + y.toFixed(1));
        dot(measuredDots, x, y, "roof-measured-dot", 3);
        lastY = y;
      });
      show = pts.length > 0;
      if (show) {
        measuredLine.setAttribute("points", pts.join(" "));
        /* keep the label out of the axis when the line rides near the top */
        measuredLabel.setAttribute("x", String(W - PAD_R - 4));
        measuredLabel.setAttribute("y", String(lastY < 44 ? lastY + 15 : lastY - 6));
      }
    }
    measuredGroup.classList.toggle("on", show);
    if (measuredNote) {
      measuredNote.hidden = !show;
      if (show) {
        measuredNote.textContent = fill(t("roofline.measuredNote"), {
          g: gflopsText(measured.gflops),
          f: fmt(measured.gflops / CLOCK_GHZ),
          clock: fmt(CLOCK_GHZ)
        });
      }
    }
    if (sweepNote) sweepNote.hidden = !show;

    /* the SIMD tier: FP32, twice the intensity, wider per instruction */
    var simd = measured && measured.simd;
    var simdPts = simd && simd.points;
    var showSimd = !!(simd && simd.ok && simdPts && simdPts.length);
    var simdLastY = null;
    if (showSimd) {
      simdPts.forEach(function (p) {
        var perCycle = p.gflops / CLOCK_GHZ;
        if (!(perCycle > 0) || perCycle >= Y_MAX) return;
        var x = xPos(p.n / NAIVE_AI_FP32);
        var y = yPos(perCycle);
        dot(simdDots, x, y, "roof-simd-dot", 4);
        simdLastY = y;
      });
      showSimd = simdLastY != null;
      if (showSimd) {
        simdLabel.setAttribute("x", String(W - PAD_R - 4));
        simdLabel.setAttribute("y", String(simdLastY - 22));
      }
    }
    simdGroup.classList.toggle("on", showSimd);
    if (simdNote) {
      simdNote.hidden = !showSimd;
      if (showSimd) {
        var head = null;
        simdPts.forEach(function (p) {
          if (!head || p.n > head.n) head = p;
        });
        simdNote.textContent = fill(t("roofline.simdNote"), { g: gflopsText(head.gflops) });
      }
    }
    if (measuredPrompt) measuredPrompt.hidden = show;
  }

  function refreshMeasured() {
    measured = readMeasuredData();
    updateMeasured();
  }

  /* Measure right here: the same engine the homepage runs, narrated into a
     status line instead of a button label. */
  var measuring = false;
  if (runBtn) {
    runBtn.addEventListener("click", function () {
      if (measuring || !window.siteBench || !window.siteBench.run) return;
      measuring = true;
      runBtn.disabled = true;
      if (statusLine) statusLine.textContent = t("roofline.measureStart");
      window.siteBench.run(function (p) {
        if (!statusLine) return;
        if (p.kind === "scalar") {
          statusLine.textContent = p.skipped
            ? fill(t("roofline.measureSkip"), { n: p.n })
            : fill(t("roofline.measureStep"), { n: p.n });
        } else if (p.kind === "simd") {
          statusLine.textContent = p.unsupported
            ? t("roofline.measureSimdNA")
            : t("roofline.measureSimd");
        }
      }).then(function (res) {
        measuring = false;
        runBtn.disabled = false;
        measured = res;
        updateMeasured();
        if (statusLine) {
          statusLine.textContent = res.ok
            ? fill(t("roofline.measureDone"), { g: gflopsText(res.gflops) })
            : t("roofline.measureBad");
        }
      });
    });
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
  /* A run that finished on this very page (the measure button, or anything
     else that calls siteBench.run) announces itself here. Back from the
     homepage after benching may restore this page from the back-forward
     cache without a reload; a bench in another tab arrives as a storage
     event. All of them just re-read the store. */
  document.addEventListener("site-bench", refreshMeasured);
  window.addEventListener("pageshow", refreshMeasured);
  window.addEventListener("storage", function (e) {
    if (e.key === "site-bench") refreshMeasured();
  });
})();
