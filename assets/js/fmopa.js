/* SME FMOPA, drawn at SVL = 128 bits so the .s tile is 4×4.
   za[row, col] += z0[row] * z1[col] when p0[row] and p1[col] are active;
   an inactive lane leaves the element unchanged (/m).
   Predicate bits are clickable, the walk can be watched cell by cell or as
   one parallel instruction, and ZA / z0 / z1 can be re-rolled. */
(function () {
  "use strict";

  var root = document.querySelector("[data-fmopa]");
  if (!root) return;

  var Z0 = [1, 2, 3, 4];
  var Z1 = [2, 1, 3, 1];
  var ZA0 = [
    [0, 1, 0, 2],
    [1, 0, 2, 0],
    [0, 1, 0, 1],
    [2, 0, 1, 0]
  ];
  var P0 = [1, 1, 1, 1];
  var P1 = [1, 1, 0, 1];
  var mode = "step"; /* step | parallel */

  var playBtn = root.querySelector("[data-action='play']");
  var replayBtn = root.querySelector("[data-action='replay']");
  var backBtn = root.querySelector("[data-action='back']");
  var fwdBtn = root.querySelector("[data-action='fwd']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var stage = root.querySelector(".stage");
  var lastState = "idle";
  var flight = false; /* parallel one-shot in progress */
  var flightTimer = null;

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

  function labelCell(cell, row, col, value) {
    cell.setAttribute("aria-label", fill(t("fmopa.cell"), { r: row, c: col, value: value }));
  }

  function setCell(cell, row, col, value) {
    cell.querySelector(".cell-value").textContent = String(value);
    labelCell(cell, row, col, value);
  }

  function buildSteps() {
    var list = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var active = P0[r] === 1 && P1[c] === 1;
        var product = Z0[r] * Z1[c];
        list.push({
          r: r,
          c: c,
          a: Z0[r],
          b: Z1[c],
          active: active,
          before: ZA0[r][c],
          after: active ? ZA0[r][c] + product : ZA0[r][c]
        });
      }
    }
    return list;
  }

  var steps = buildSteps();

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

  function syncPreds() {
    root.querySelectorAll(".pred").forEach(function (button) {
      var which = button.getAttribute("data-pred") === "0" ? P0 : P1;
      var lane = button.getAttribute("data-lane");
      var on = which[lane] === 1;
      button.textContent = on ? "1" : "0";
      button.classList.toggle("is-off", !on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute(
        "aria-label",
        fill(t(button.getAttribute("data-pred") === "0" ? "fmopa.predLane0" : "fmopa.predLane1"), { n: lane })
      );
    });
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("fmopa.valuesTpl"), {
      z0: "{" + Z0.join(", ") + "}",
      z1: "{" + Z1.join(", ") + "}"
    });
  }

  function clearFlags() {
    root
      .querySelectorAll(".is-live, .is-dead, .is-row, .is-col, .is-armed, .is-hot, .is-done, .is-kept")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-row", "is-col", "is-armed", "is-hot", "is-done", "is-kept");
      });
  }

  /* Highlight the operands a step touches; a zero predicate lane reads as dead. */
  function markSources(step) {
    ["z0", "z1"].forEach(function (name) {
      var lane = name === "z0" ? step.r : step.c;
      var node = root.querySelector('[data-vec="' + name + '"][data-lane="' + lane + '"]');
      if (node) node.classList.add("is-live");
    });
    [
      { pred: 0, lane: step.r, on: P0[step.r] === 1 },
      { pred: 1, lane: step.c, on: P1[step.c] === 1 }
    ].forEach(function (item) {
      var node = root.querySelector('[data-pred="' + item.pred + '"][data-lane="' + item.lane + '"]');
      if (node) node.classList.add(item.on ? "is-live" : "is-dead");
    });
    root.querySelectorAll('.cell[data-r="' + step.r + '"]').forEach(function (node) {
      node.classList.add("is-row");
    });
    root.querySelectorAll('.cell[data-c="' + step.c + '"]').forEach(function (node) {
      node.classList.add("is-col");
    });
  }

  function drawTile(count, hotLast) {
    stage.classList.add("is-instant");
    clearFlags();
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        setCell(cellAt(row, col), row, col, ZA0[row][col]);
      }
    }
    void stage.offsetWidth;
    stage.classList.remove("is-instant");
    for (var i = 0; i < count; i++) {
      var step = steps[i];
      var cell = cellAt(step.r, step.c);
      if (step.active) {
        setCell(cell, step.r, step.c, step.after);
        cell.classList.add("is-done");
      } else {
        cell.classList.add("is-kept");
      }
    }
    if (count > 0) {
      var last = steps[count - 1];
      var lastCell = cellAt(last.r, last.c);
      if (hotLast) {
        if (last.active) {
          lastCell.classList.remove("is-done");
          lastCell.classList.add("is-hot");
        }
        markSources(last);
      }
    }
  }

  function stopFlight() {
    if (flightTimer) {
      clearTimeout(flightTimer);
      flightTimer = null;
    }
    flight = false;
    root.removeAttribute("aria-busy");
  }

  var player = window.simdPlayer({
    steps: steps,
    onReset: function () {
      stopFlight();
      drawTile(0, false);
    },
    onArm: function (step) {
      var previous = root.querySelector(".cell.is-hot");
      if (previous) {
        previous.classList.remove("is-hot");
        previous.classList.add("is-done");
      }
      root.querySelectorAll(".is-live, .is-dead, .is-row, .is-col, .is-armed").forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-row", "is-col", "is-armed");
      });
      markSources(step);
      cellAt(step.r, step.c).classList.add(step.active ? "is-armed" : "is-kept");
    },
    onCommit: function (step) {
      var cell = cellAt(step.r, step.c);
      if (step.active) {
        cell.classList.remove("is-armed");
        cell.classList.add("is-hot");
        setCell(cell, step.r, step.c, step.after);
      }
    },
    onSeek: function (count) {
      drawTile(count, true);
    },
    onApplyAll: function () {
      drawTile(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector(".cell.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      root.querySelectorAll(".is-live, .is-dead, .is-row, .is-col, .is-armed").forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-row", "is-col", "is-armed");
      });
      announce(t(mode === "parallel" ? "fmopa.parallelDone" : reducedMotion() ? "fmopa.doneReduced" : "fmopa.done"));
    },
    onState: function (state, committed, total, armed) {
      if (state === "paused" && lastState === "playing") {
        announce(fill(t("fmopa.annPaused"), { n: committed, total: total }));
      }
      if (state === "playing") root.setAttribute("aria-busy", "true");
      else root.removeAttribute("aria-busy");
      lastState = state;
      render(state, committed, armed);
    },
    onMotionChange: function (reducedNow) {
      if (motionNote) motionNote.hidden = !reducedNow;
      if (reducedNow) {
        stopFlight();
        if (player.getState() === "playing") player.jumpEnd();
        return;
      }
      render();
    }
  });

  /* Safe before the player assignment completes: the player emits once during construction. */
  function reducedMotion() {
    if (player) return player.reduced();
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function renderCaption(state, committed, armed) {
    if (!caption) return;
    if (mode === "parallel") {
      var key = "fmopa.idle";
      if (state === "done") key = "fmopa.parallelDone";
      else if (flight) key = "fmopa.parallelCaption";
      caption.textContent = t(key);
      return;
    }
    if (state === "done") {
      caption.textContent = t(reducedMotion() ? "fmopa.doneReduced" : "fmopa.done");
      return;
    }
    /* While a step is armed, explain the cell being highlighted, not the last one. */
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("fmopa.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "fmopa.starting" : "fmopa.idle");
    } else {
      caption.textContent = fill(t(step.active ? "fmopa.stepCaption" : "fmopa.skipCaption"), step);
    }
  }

  function renderChrome(state, committed, armed) {
    if (playBtn) {
      playBtn.textContent = t(state === "playing" ? "fmopa.pause" : state === "paused" ? "fmopa.resume" : "fmopa.play");
    }
    if (counter) {
      var shown = state === "playing" && armed >= 0 ? armed + 1 : committed;
      counter.textContent =
        mode === "parallel"
          ? t("fmopa.parallelCounter")
          : fill(t("fmopa.step"), { n: shown, total: steps.length });
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
    updateValuesLine();
    render();
  }

  function playParallel() {
    if (flight) return;
    if (player.reduced()) {
      player.jumpEnd();
      return;
    }
    player.reset();
    flight = true;
    root.setAttribute("aria-busy", "true");
    clearFlags();
    /* One instruction: every operand and predicate takes part at once. */
    root.querySelectorAll("[data-vec]").forEach(function (node) {
      node.classList.add("is-live");
    });
    root.querySelectorAll(".pred").forEach(function (node) {
      node.classList.add(node.classList.contains("is-off") ? "is-dead" : "is-live");
    });
    steps.forEach(function (step) {
      cellAt(step.r, step.c).classList.add(step.active ? "is-armed" : "is-kept");
    });
    renderCaption("idle", 0);
    flightTimer = setTimeout(function () {
      flightTimer = null;
      flight = false;
      root.removeAttribute("aria-busy");
      player.jumpEnd();
    }, 700);
  }

  function handlePlayToggle() {
    if (mode === "parallel") {
      stopFlight();
      player.reset();
      playParallel();
      return;
    }
    stopFlight();
    if (player.getState() === "playing") player.pause();
    else player.play();
  }

  function handleReplay() {
    stopFlight();
    if (mode === "parallel") {
      player.reset();
      playParallel();
      return;
    }
    player.reset();
    player.play();
  }

  function syncModeButtons() {
    root.querySelectorAll("[data-mode]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-mode") === mode ? "true" : "false");
    });
  }

  if (playBtn) playBtn.addEventListener("click", handlePlayToggle);
  if (replayBtn) replayBtn.addEventListener("click", handleReplay);
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (mode === "parallel" || flight) return;
      player.stepBack();
    });
  }
  if (fwdBtn) {
    fwdBtn.addEventListener("click", function () {
      if (mode === "parallel" || flight) return;
      player.stepForward();
    });
  }
  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      stopFlight();
      randomize();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("fmopa.annRandom"));
    });
  }

  function randomize() {
    for (var i = 0; i < 4; i++) {
      Z0[i] = 1 + Math.floor(Math.random() * 3);
      Z1[i] = 1 + Math.floor(Math.random() * 3);
      for (var j = 0; j < 4; j++) {
        ZA0[i][j] = Math.floor(Math.random() * 3);
      }
    }
    paintSources();
    updateValuesLine();
  }

  root.querySelectorAll(".pred").forEach(function (button) {
    button.addEventListener("click", function () {
      stopFlight();
      var which = button.getAttribute("data-pred") === "0" ? P0 : P1;
      var lane = button.getAttribute("data-lane");
      which[lane] = which[lane] === 1 ? 0 : 1;
      syncPreds();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("fmopa.annReset"));
    });
  });

  root.querySelectorAll("[data-mode]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = button.getAttribute("data-mode");
      if (next === mode) return;
      stopFlight();
      mode = next;
      syncModeButtons();
      player.reset();
      render();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;
    var tag = event.target && event.target.tagName;
    if ((event.key === " " || event.key === "Enter") && tag === "BUTTON") return;
    if (event.key === "ArrowRight") {
      if (mode !== "parallel" && !flight) {
        event.preventDefault();
        player.stepForward();
      }
    } else if (event.key === "ArrowLeft") {
      if (mode !== "parallel" && !flight) {
        event.preventDefault();
        player.stepBack();
      }
    } else if (event.key === " ") {
      event.preventDefault();
      handlePlayToggle();
    }
  });

  paintSources();
  syncModeButtons();
  renderAll();

  document.addEventListener("site-lang", renderAll);
})();
