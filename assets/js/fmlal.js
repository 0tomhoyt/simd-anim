/* SME2 FMLAL, drawn at SVL = 128 bits: eight .h halfs in, two adjacent
   ZA.S slices out. Slice 4 gains FP32(z0.h[2c]) * FP32(z1.h[idx]) at
   element c; slice 5 gains FP32(z0.h[2c+1]) * the same multiplier.
   The index is switchable live; the instruction is unpredicated. */
(function () {
  "use strict";

  var root = document.querySelector("[data-fmlal]");
  if (!root) return;

  var Z0 = [1, 2, 2, 1, 1, 3, 2, 2]; /* half floats */
  var Z1 = [2, 1, 3, 1, 2, 3, 1, 2]; /* half floats */
  var ZA = [
    [0, 1, 0, 2], /* slice 4, single precision */
    [1, 0, 2, 0] /* slice 5, single precision */
  ];
  var IDX = 2;
  var SLICE_BASE = 4; /* w11 + 4:5 selects slices 4 and 5 */

  var playBtn = root.querySelector("[data-action='play']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var opline = root.querySelector("[data-opline]");
  var lastState = "idle";

  function t(key) {
    return window.siteI18n && window.siteI18n.t ? window.siteI18n.t(key) : key;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function announce(message) {
    if (announcer) announcer.textContent = message;
  }

  function halfAt(lane) {
    return root.querySelector('[data-vec="z0"][data-lane="' + lane + '"]');
  }

  function cellAt(sliceIndex, col) {
    return root.querySelector('.cell[data-s="' + (SLICE_BASE + sliceIndex) + '"][data-c="' + col + '"]');
  }

  function labelCell(cell, slice, col, value) {
    cell.setAttribute("aria-label", fill(t("fmlal.cellAria"), { s: slice, c: col, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var i = 0; i < 2; i++) {
      for (var e = 0; e < 4; e++) {
        var h = 2 * e + i;
        list.push({
          s: SLICE_BASE + i,
          c: e,
          h: h,
          a: Z0[h],
          b: Z1[IDX],
          idx: IDX,
          before: ZA[i][e],
          after: ZA[i][e] + Z0[h] * Z1[IDX]
        });
      }
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    Z0.forEach(function (value, lane) {
      var node = halfAt(lane);
      if (node) node.textContent = String(value);
    });
    root.querySelectorAll("[data-sel]").forEach(function (button) {
      var k = +button.getAttribute("data-sel");
      button.textContent = String(Z1[k]);
      button.setAttribute("aria-pressed", k === IDX ? "true" : "false");
    });
    if (opline) opline.textContent = "× z1.h[" + IDX + "] = " + Z1[IDX];
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("fmlal.values"), { idx: IDX, value: Z1[IDX] });
  }

  function clearFlags() {
    root
      .querySelectorAll(".is-live, .is-armed, .is-hot, .is-done, .is-kept")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-armed", "is-hot", "is-done", "is-kept");
      });
  }

  function markSources(step) {
    var half = halfAt(step.h);
    if (half) half.classList.add("is-live");
    var button = root.querySelector('[data-sel="' + IDX + '"]');
    if (button) button.classList.add("is-live");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 2; i++) {
      for (var e = 0; e < 4; e++) {
        var cell = cellAt(i, e);
        cell.querySelector(".cell-value").textContent = String(ZA[i][e]);
        labelCell(cell, SLICE_BASE + i, e, ZA[i][e]);
      }
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var target = cellAt(step.s - SLICE_BASE, step.c);
      target.querySelector(".cell-value").textContent = String(step.after);
      labelCell(target, step.s, step.c, step.after);
      target.classList.add("is-done");
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastCell = cellAt(last.s - SLICE_BASE, last.c);
      lastCell.classList.remove("is-done");
      lastCell.classList.add("is-hot");
      markSources(last);
    }
  }

  var player = window.simdPlayer({
    steps: steps,
    onReset: function () {
      drawState(0, false);
    },
    onArm: function (step) {
      var previous = root.querySelector(".cell.is-hot");
      if (previous) {
        previous.classList.remove("is-hot");
        previous.classList.add("is-done");
      }
      root.querySelectorAll(".is-live, .is-armed").forEach(function (node) {
        node.classList.remove("is-live", "is-armed");
      });
      markSources(step);
      cellAt(step.s - SLICE_BASE, step.c).classList.add("is-armed");
    },
    onCommit: function (step) {
      var cell = cellAt(step.s - SLICE_BASE, step.c);
      cell.classList.remove("is-armed");
      cell.classList.add("is-hot");
      cell.querySelector(".cell-value").textContent = String(step.after);
      labelCell(cell, step.s, step.c, step.after);
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector(".cell.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      root.querySelectorAll(".is-live, .is-armed").forEach(function (node) {
        node.classList.remove("is-live", "is-armed");
      });
      announce(fill(t("fmlal.done"), { idx: IDX }));
    },
    onState: function (state, committed, total, armed) {
      if (state === "paused" && lastState === "playing") {
        announce(fill(t("ui.paused"), { n: committed, total: total }));
      }
      if (state === "playing") root.setAttribute("aria-busy", "true");
      else root.removeAttribute("aria-busy");
      lastState = state;
      render(state, committed, armed);
    },
    onMotionChange: function (reducedNow) {
      if (motionNote) motionNote.hidden = !reducedNow;
      if (reducedNow && player.getState() === "playing") player.jumpEnd();
      else render();
    }
  });

  function reducedMotion() {
    if (player) return player.reduced();
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function renderCaption(state, committed, armed) {
    if (!caption) return;
    if (state === "done") {
      caption.textContent = fill(t("fmlal.done"), { idx: IDX });
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("fmlal.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "fmlal.idle");
    } else {
      caption.textContent = fill(t("fmlal.stepCaption"), step);
    }
  }

  function renderChrome(state, committed, armed) {
    if (playBtn) {
      playBtn.textContent = t(state === "playing" ? "ui.pause" : state === "paused" ? "ui.resume" : "ui.play");
    }
    if (counter) {
      var shown = state === "playing" && armed >= 0 ? armed + 1 : committed;
      counter.textContent = fill(t("ui.step"), { n: shown, total: steps.length });
    }
    if (motionNote) motionNote.hidden = !reducedMotion();
  }

  function render(state, committed, armed) {
    state = state || player.getState();
    committed = committed != null ? committed : player.getCommitted();
    armed = armed != null ? armed : player.getArmed();
    renderChrome(state, committed, armed);
    renderCaption(state, committed, armed);
  }

  function renderAll() {
    paintSources();
    updateValuesLine();
    render();
  }

  root.querySelectorAll("[data-sel]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = +button.getAttribute("data-sel");
      if (next === IDX) return;
      IDX = next;
      paintSources();
      updateValuesLine();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      Z0 = Z0.map(function () {
        return 1 + Math.floor(Math.random() * 3);
      });
      Z1 = Z1.map(function () {
        return 1 + Math.floor(Math.random() * 3);
      });
      for (var i = 0; i < 2; i++) {
        for (var e = 0; e < 4; e++) {
          ZA[i][e] = Math.floor(Math.random() * 3);
        }
      }
      paintSources();
      updateValuesLine();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("ui.annRandom"));
    });
  }

  window.simdControls({ root: root, player: player });

  renderAll();

  document.addEventListener("site-lang", renderAll);
})();
