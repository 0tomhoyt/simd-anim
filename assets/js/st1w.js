/* SME ST1W, drawn at SVL = 128 bits: the .s tile is 4×4.
   mem[x0 + 4*j] = ZA[w12, j] when p0[j] is active; memory is untouched
   otherwise. W12 picks the horizontal slice and is switchable live. */
(function () {
  "use strict";

  var root = document.querySelector("[data-st1w]");
  if (!root) return;

  var ZA = [
    [2, 0, 3, 1],
    [1, 4, 0, 2],
    [0, 1, 5, 3],
    [3, 2, 1, 0]
  ];
  var MEM = [8, 3, 6, 1, 7]; /* words 0..3 receive the slice; 4 stays out */
  var P0 = [1, 1, 0, 1];
  var W12 = 0;

  var playBtn = root.querySelector("[data-action='play']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
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

  function cellAt(row, col) {
    return root.querySelector('.cell[data-r="' + row + '"][data-c="' + col + '"]');
  }

  function memAt(index) {
    return root.querySelector('[data-mem="' + index + '"]');
  }

  function labelCell(cell, row, col, value) {
    cell.setAttribute("aria-label", fill(t("st1w.cellAria"), { r: row, c: col, value: value }));
  }

  function labelMem(node, index, value) {
    node.setAttribute("aria-label", fill(t("st1w.memWordAria"), { index: index, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var lane = 0; lane < 4; lane++) {
      var active = P0[lane] === 1;
      list.push({
        lane: lane, /* caption vocabulary, as on the sibling pages */
        off: 4 * lane,
        r: W12,
        value: ZA[W12][lane],
        active: active,
        before: MEM[lane],
        after: active ? ZA[W12][lane] : MEM[lane]
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var cell = cellAt(row, col);
        cell.querySelector(".cell-value").textContent = String(ZA[row][col]);
        labelCell(cell, row, col, ZA[row][col]);
      }
    }
    MEM.forEach(function (value, index) {
      var node = memAt(index);
      if (node) {
        node.textContent = String(value);
        if (index < 4) labelMem(node, index, value);
      }
    });
  }

  function syncPreds() {
    root.querySelectorAll(".pred").forEach(function (button) {
      var lane = button.getAttribute("data-lane");
      var on = P0[lane] === 1;
      button.textContent = on ? "1" : "0";
      button.classList.toggle("is-off", !on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute("aria-label", fill(t("ui.predLane"), { n: lane }));
    });
  }

  function syncSlice() {
    root.querySelectorAll("[data-slice]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-slice") === String(W12) ? "true" : "false");
    });
    root.querySelectorAll(".cell.is-slice").forEach(function (cell) {
      cell.classList.remove("is-slice");
    });
    for (var col = 0; col < 4; col++) {
      cellAt(W12, col).classList.add("is-slice");
    }
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("st1w.values"), {
      r: W12,
      mem: "{" + MEM.slice(0, 4).join(", ") + "}"
    });
  }

  function clearFlags() {
    root
      .querySelectorAll(".is-live, .is-dead, .is-armed, .is-hot, .is-done, .is-kept")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-armed", "is-hot", "is-done", "is-kept");
      });
  }

  function clearTransient() {
    root.querySelectorAll(".is-live, .is-dead, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-dead", "is-armed");
    });
  }

  function markSources(step) {
    var cell = cellAt(step.r, step.lane);
    if (cell) cell.classList.add("is-live");
    var pred = root.querySelector('[data-pred="0"][data-lane="' + step.lane + '"]');
    if (pred) pred.classList.add(step.active ? "is-live" : "is-dead");
    if (step.active) {
      var word = memAt(step.lane);
      if (word) word.classList.add("is-live");
    }
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var node = memAt(i);
      node.textContent = String(MEM[i]);
      labelMem(node, i, MEM[i]);
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var word = memAt(step.lane);
      if (step.active) {
        word.textContent = String(step.after);
        labelMem(word, step.lane, step.after);
        word.classList.add("is-done");
      } else {
        word.classList.add("is-kept");
      }
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      if (last.active) {
        var lastWord = memAt(last.lane);
        lastWord.classList.remove("is-done");
        lastWord.classList.add("is-hot");
      }
      markSources(last);
    }
  }

  var player = window.simdPlayer({
    steps: steps,
    gapMs: 340,
    onReset: function () {
      drawState(0, false);
    },
    onArm: function (step) {
      var hot = root.querySelector(".mem-value.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      markSources(step);
      memAt(step.lane).classList.add(step.active ? "is-armed" : "is-kept");
    },
    onCommit: function (step) {
      var word = memAt(step.lane);
      word.classList.remove("is-armed");
      if (step.active) {
        word.classList.add("is-hot");
        word.textContent = String(step.after);
        labelMem(word, step.lane, step.after);
      } else {
        word.classList.add("is-kept");
      }
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector(".mem-value.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      announce(fill(t("st1w.done"), { r: W12 }));
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
      caption.textContent = fill(t("st1w.done"), { r: W12 });
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("st1w.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "st1w.idle");
    } else {
      caption.textContent = fill(t(step.active ? "st1w.stepCaption" : "st1w.skipCaption"), step);
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
    syncPreds();
    syncSlice();
    updateValuesLine();
    relabel();
    render();
  }

  /* Labels carry the language; re-derive them from what the picture shows,
     so a language switch does not leave them behind in the old one. */
  function relabel() {
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var cell = cellAt(row, col);
        labelCell(cell, row, col, cell.querySelector(".cell-value").textContent);
      }
    }
    for (var i = 0; i < 4; i++) {
      var word = memAt(i);
      if (word) labelMem(word, i, word.textContent);
    }
  }

  function reconfigure() {
    steps = buildSteps();
    player.setSteps(steps);
    announce(t("ui.annReset"));
  }

  root.querySelectorAll(".pred").forEach(function (button) {
    button.addEventListener("click", function () {
      var lane = button.getAttribute("data-lane");
      P0[lane] = P0[lane] === 1 ? 0 : 1;
      syncPreds();
      reconfigure();
    });
  });

  root.querySelectorAll("[data-slice]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = +button.getAttribute("data-slice");
      if (next === W12) return;
      W12 = next;
      syncSlice();
      updateValuesLine();
      reconfigure();
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 4; col++) {
          ZA[row][col] = Math.floor(Math.random() * 6);
        }
      }
      MEM = MEM.map(function () {
        return Math.floor(Math.random() * 10);
      });
      paintSources();
      updateValuesLine();
      reconfigure();
      announce(t("ui.annRandom"));
    });
  }

  window.simdControls({ root: root, player: player });

  paintSources();
  renderAll();

  document.addEventListener("site-lang", renderAll);
})();
