/* SME ADDVA, drawn at SVL = 128 bits so za0.s is a 4×4 tile.
   ZA[i, j] += z0[i] when p0[i] and p1[j] are active — the vector runs
   down every active column. Both predicates are clickable. */
(function () {
  "use strict";

  var root = document.querySelector("[data-addva]");
  if (!root) return;

  var ZV = [1, 2, 3, 4];
  var ZA0 = [
    [0, 1, 0, 2],
    [1, 0, 2, 0],
    [0, 1, 0, 1],
    [2, 0, 1, 0]
  ];
  var P0 = [1, 1, 1, 1];
  var P1 = [1, 1, 0, 1];

  var playBtn = root.querySelector("[data-action='play']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var stage = root.querySelector(".stage");
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

  function labelCell(cell, row, col, value) {
    cell.setAttribute("aria-label", fill(t("addva.cellAria"), { r: row, c: col, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var active = P0[r] === 1 && P1[c] === 1;
        list.push({
          r: r,
          c: c,
          a: ZV[r],
          active: active,
          before: ZA0[r][c],
          after: active ? ZA0[r][c] + ZV[r] : ZA0[r][c]
        });
      }
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    ZV.forEach(function (value, lane) {
      var node = root.querySelector('[data-vec="z0"][data-lane="' + lane + '"]');
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
        fill(t(which === P0 ? "addva.predLane0" : "addva.predLane1"), { n: lane })
      );
    });
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("addva.values"), { z0: "{" + ZV.join(", ") + "}" });
  }

  function clearFlags() {
    root
      .querySelectorAll(".is-live, .is-dead, .is-row, .is-col, .is-armed, .is-hot, .is-done, .is-kept")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-row", "is-col", "is-armed", "is-hot", "is-done", "is-kept");
      });
  }

  function markSources(step) {
    var vector = root.querySelector('[data-vec="z0"][data-lane="' + step.r + '"]');
    if (vector) vector.classList.add("is-live");
    var p0 = root.querySelector('[data-pred="0"][data-lane="' + step.r + '"]');
    var p1 = root.querySelector('[data-pred="1"][data-lane="' + step.c + '"]');
    if (p0) p0.classList.add(P0[step.r] === 1 ? "is-live" : "is-dead");
    if (p1) p1.classList.add(P1[step.c] === 1 ? "is-live" : "is-dead");
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
        var cell = cellAt(row, col);
        cell.querySelector(".cell-value").textContent = String(ZA0[row][col]);
        labelCell(cell, row, col, ZA0[row][col]);
      }
    }
    void stage.offsetWidth;
    stage.classList.remove("is-instant");
    for (var i = 0; i < count; i++) {
      var step = steps[i];
      var target = cellAt(step.r, step.c);
      if (step.active) {
        target.querySelector(".cell-value").textContent = String(step.after);
        labelCell(target, step.r, step.c, step.after);
        target.classList.add("is-done");
      } else {
        target.classList.add("is-kept");
      }
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastCell = cellAt(last.r, last.c);
      if (last.active) {
        lastCell.classList.remove("is-done");
        lastCell.classList.add("is-hot");
      }
      markSources(last);
    }
  }

  var player = window.simdPlayer({
    steps: steps,
    onReset: function () {
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
      if (!step.active) return;
      var cell = cellAt(step.r, step.c);
      cell.classList.remove("is-armed");
      cell.classList.add("is-hot");
      cell.querySelector(".cell-value").textContent = String(step.after);
      labelCell(cell, step.r, step.c, step.after);
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
      announce(t("addva.done"));
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
      caption.textContent = t("addva.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("addva.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "addva.idle");
    } else {
      caption.textContent = fill(t(step.active ? "addva.stepCaption" : "addva.skipCaption"), step);
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
    updateValuesLine();
    render();
  }

  root.querySelectorAll(".pred").forEach(function (button) {
    button.addEventListener("click", function () {
      var which = button.getAttribute("data-pred") === "0" ? P0 : P1;
      var lane = button.getAttribute("data-lane");
      which[lane] = which[lane] === 1 ? 0 : 1;
      syncPreds();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      for (var lane = 0; lane < 4; lane++) {
        ZV[lane] = 1 + Math.floor(Math.random() * 3);
      }
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 4; col++) {
          ZA0[row][col] = Math.floor(Math.random() * 3);
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

  paintSources();
  renderAll();

  document.addEventListener("site-lang", function () {
    renderAll();
    drawTile(player.getCommitted(), false);
  });
})();
