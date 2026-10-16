/* SME FMOPA, drawn at SVL = 128 bits so the .s tile is 4×4.
   za[row, col] += z0[row] * z1[col] when p0[row] and p1[col] are active. */
(function () {
  "use strict";

  var root = document.querySelector("[data-fmopa]");
  if (!root) return;

  var Z0 = [1, 2, 3, 4];
  var Z1 = [2, 1, 3, 1];
  var ZA = [
    [0, 1, 0, 2],
    [1, 0, 2, 0],
    [0, 1, 0, 1],
    [2, 0, 1, 0]
  ];

  var steps = [];
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      var product = Z0[r] * Z1[c];
      steps.push({
        r: r,
        c: c,
        a: Z0[r],
        b: Z1[c],
        before: ZA[r][c],
        after: ZA[r][c] + product
      });
    }
  }

  var playBtn = root.querySelector("[data-action='play']");
  var replayBtn = root.querySelector("[data-action='replay']");
  var caption = root.querySelector("[data-caption]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var stage = root.querySelector(".stage");
  var timer = null;
  var playing = false;
  var phase = "idle";
  var index = -1;
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function reduced() {
    return motionQuery ? motionQuery.matches : false;
  }

  function t(key) {
    return window.siteI18n && window.siteI18n.t ? window.siteI18n.t(key) : key;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function cellAt(row, col) {
    return root.querySelector('.cell[data-r="' + row + '"][data-c="' + col + '"]');
  }

  function labelCell(cell, row, col, value) {
    cell.setAttribute("aria-label", fill(t("fmopa.cell"), { r: row, c: col, value: value }));
  }

  function paintSources() {
    Z0.forEach(function (value, lane) {
      var node = root.querySelector('[data-vec="z0"][data-lane="' + lane + '"]');
      if (node) node.textContent = String(value);
    });
    Z1.forEach(function (value, lane) {
      var node = root.querySelector('[data-vec="z1"][data-lane="' + lane + '"]');
      if (node) node.textContent = String(value);
    });
  }

  function clearFlags() {
    root.querySelectorAll(".is-live, .is-row, .is-col, .is-armed, .is-hot, .is-done").forEach(function (node) {
      node.classList.remove("is-live", "is-row", "is-col", "is-armed", "is-hot", "is-done");
    });
  }

  function resetTile() {
    stage.classList.add("is-instant");
    clearFlags();
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var cell = cellAt(row, col);
        var value = ZA[row][col];
        cell.querySelector(".cell-value").textContent = String(value);
        labelCell(cell, row, col, value);
      }
    }
    void stage.offsetWidth;
    stage.classList.remove("is-instant");
  }

  function renderChrome() {
    if (playBtn) playBtn.textContent = t("fmopa.play");
    if (replayBtn) replayBtn.textContent = t("fmopa.replay");
    if (motionNote) motionNote.hidden = !reduced();
    var shown = phase === "idle" ? 0 : index + 1;
    if (counter) counter.textContent = fill(t("fmopa.step"), { n: shown, total: steps.length });
  }

  function refreshCellLabels() {
    root.querySelectorAll(".cell").forEach(function (cell) {
      var value = cell.querySelector(".cell-value").textContent;
      labelCell(cell, cell.getAttribute("data-r"), cell.getAttribute("data-c"), value);
    });
  }

  function renderCaption() {
    if (!caption) return;
    if (phase === "done") {
      caption.textContent = t(reduced() ? "fmopa.doneReduced" : "fmopa.done");
      return;
    }
    var step = steps[index];
    if (phase !== "play" || !step) {
      caption.textContent = t("fmopa.idle");
      return;
    }
    caption.textContent = fill(t("fmopa.stepCaption"), step);
  }

  function render() {
    renderChrome();
    renderCaption();
    refreshCellLabels();
  }

  function stopTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    playing = false;
    root.removeAttribute("aria-busy");
  }

  function markSources(step) {
    root.querySelectorAll(".is-live, .is-row, .is-col, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-row", "is-col", "is-armed");
    });
    ["z0", "z1"].forEach(function (name) {
      var lane = name === "z0" ? step.r : step.c;
      var node = root.querySelector('[data-vec="' + name + '"][data-lane="' + lane + '"]');
      if (node) node.classList.add("is-live");
    });
    var p0 = root.querySelector('[data-pred="0"][data-lane="' + step.r + '"]');
    var p1 = root.querySelector('[data-pred="1"][data-lane="' + step.c + '"]');
    if (p0) p0.classList.add("is-live");
    if (p1) p1.classList.add("is-live");
    root.querySelectorAll('.cell[data-r="' + step.r + '"]').forEach(function (node) {
      node.classList.add("is-row");
    });
    root.querySelectorAll('.cell[data-c="' + step.c + '"]').forEach(function (node) {
      node.classList.add("is-col");
    });
  }

  function arm(step) {
    var previous = root.querySelector(".cell.is-hot");
    if (previous) {
      previous.classList.remove("is-hot");
      previous.classList.add("is-done");
    }
    markSources(step);
    cellAt(step.r, step.c).classList.add("is-armed");
  }

  function commit(step) {
    var cell = cellAt(step.r, step.c);
    cell.classList.remove("is-armed");
    cell.classList.add("is-hot");
    cell.querySelector(".cell-value").textContent = String(step.after);
    labelCell(cell, step.r, step.c, step.after);
  }

  function finish() {
    stopTimer();
    var hot = root.querySelector(".cell.is-hot");
    if (hot) {
      hot.classList.remove("is-hot");
      hot.classList.add("is-done");
    }
    root.querySelectorAll(".is-live, .is-row, .is-col, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-row", "is-col", "is-armed");
    });
    phase = "done";
    index = steps.length - 1;
    render();
  }

  function applyAll() {
    stopTimer();
    stage.classList.add("is-instant");
    clearFlags();
    steps.forEach(function (step) {
      var cell = cellAt(step.r, step.c);
      cell.classList.add("is-done");
      cell.querySelector(".cell-value").textContent = String(step.after);
      labelCell(cell, step.r, step.c, step.after);
    });
    void stage.offsetWidth;
    stage.classList.remove("is-instant");
    phase = "done";
    index = steps.length - 1;
    render();
  }

  function run(i) {
    if (!playing) return;
    if (reduced()) {
      applyAll();
      return;
    }
    if (i >= steps.length) {
      finish();
      return;
    }
    index = i;
    phase = "play";
    arm(steps[i]);
    render();
    timer = setTimeout(function () {
      commit(steps[i]);
      timer = setTimeout(function () {
        run(i + 1);
      }, 260);
    }, 180);
  }

  function start() {
    stopTimer();
    resetTile();
    phase = "idle";
    index = -1;
    render();
    if (reduced()) {
      applyAll();
      return;
    }
    playing = true;
    root.setAttribute("aria-busy", "true");
    timer = setTimeout(function () {
      run(0);
    }, 120);
  }

  function onMotionChange() {
    if (motionNote) motionNote.hidden = !reduced();
    if (reduced() && playing) applyAll();
    else render();
  }

  paintSources();
  resetTile();
  render();

  if (playBtn) playBtn.addEventListener("click", start);
  if (replayBtn) replayBtn.addEventListener("click", start);
  document.addEventListener("site-lang", render);
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
})();
