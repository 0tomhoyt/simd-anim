/* A real GEMM microkernel, scaled to SVL = 128: C (8×8) = A (8×4) × B (4×8)
   computed by 2×2 ZA tiles in a K loop. The animation follows the data:
   sources → pack (gather or stride route) → panels → z registers → FMOPA
   accumulation → store. The A/B layout toggles only change the pack route;
   the loop itself never moves. */
(function () {
  "use strict";

  var root = document.querySelector("[data-mk]");
  if (!root) return;

  var M = 8;
  var N = 8;
  var K = 4;

  var A = [
    [1, 2, 1, 0],
    [2, 1, 0, 1],
    [1, 0, 2, 1],
    [0, 1, 1, 2],
    [2, 2, 0, 1],
    [1, 1, 1, 0],
    [0, 2, 1, 1],
    [2, 0, 2, 1]
  ];
  var B = [
    [1, 0, 2, 1, 0, 2, 1, 0],
    [0, 1, 2, 1, 2, 0, 1, 1],
    [2, 2, 0, 0, 1, 1, 2, 0],
    [1, 0, 1, 2, 0, 1, 0, 2]
  ];
  var stateA = "norm"; /* norm = M×K row-major, trans = K×M */
  var stateB = "norm"; /* norm = K×N row-major, trans = N×K */

  var playBtn = root.querySelector("[data-action='play']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var srcAEl = root.querySelector('[data-matrix="a"]');
  var srcBEl = root.querySelector('[data-matrix="b"]');
  var panelAEl = root.querySelector('[data-panel="a"]');
  var panelBEl = root.querySelector('[data-panel="b"]');
  var pathAEl = root.querySelector("[data-path-a]");
  var pathBEl = root.querySelector("[data-path-b]");
  var aTitleEl = root.querySelector("[data-a-title]");
  var bTitleEl = root.querySelector("[data-b-title]");
  var cBadgeEl = root.querySelector("[data-cbadge]");
  var slotsEl = root.querySelector("[data-slots]");
  var zCells = {
    a: [],
    b: []
  };
  var zaCells = []; /* zaCells[t][r][c] */
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

  function buildSteps() {
    var list = [{ t: "pack", m: "a" }, { t: "pack", m: "b" }];
    for (var k = 0; k < K; k++) {
      list.push({ t: "load", k: k, g: k + 1 });
      list.push({ t: "fmopa", k: k, g: k + 1 });
    }
    list.push({ t: "store" });
    return list;
  }

  var steps = buildSteps();

  function mkCell(text) {
    var el = document.createElement("span");
    el.className = "mk-cell";
    el.textContent = text;
    return el;
  }

  function buildGrids() {
    var el;
    for (var i = 0; i < M * K; i++) srcAEl.appendChild(mkCell("0"));
    for (var j = 0; j < K * N; j++) srcBEl.appendChild(mkCell("0"));
    for (var p = 0; p < K * M; p++) panelAEl.appendChild(mkCell("·"));
    for (var q = 0; q < K * N; q++) panelBEl.appendChild(mkCell("·"));
    ["a-0", "a-1", "b-0", "b-1"].forEach(function (key) {
      var host = root.querySelector('[data-z="' + key + '"]');
      var cells = [];
      for (var n = 0; n < 4; n++) {
        el = mkCell("·");
        host.appendChild(el);
        cells.push(el);
      }
      zCells[key.charAt(0)].push(cells);
    });
    for (var tile = 0; tile < 4; tile++) {
      var grid = root.querySelector('[data-za="' + tile + '"]');
      var rows = [];
      var rBase = tile >= 2 ? 4 : 0;
      var cBase = tile % 2 === 1 ? 4 : 0;
      for (var r = 0; r < 4; r++) {
        var row = [];
        for (var c = 0; c < 4; c++) {
          var cell = document.createElement("div");
          cell.className = "cell";
          cell.setAttribute("data-r", rBase + r);
          cell.setAttribute("data-c", cBase + c);
          var wash = document.createElement("span");
          wash.className = "wash";
          wash.setAttribute("aria-hidden", "true");
          var idx = document.createElement("span");
          idx.className = "cell-index";
          idx.textContent = rBase + r + "," + (cBase + c);
          var val = document.createElement("span");
          val.className = "cell-value";
          val.textContent = "0";
          cell.appendChild(wash);
          cell.appendChild(idx);
          cell.appendChild(val);
          grid.appendChild(cell);
          row.push(cell);
        }
        rows.push(row);
      }
      zaCells.push(rows);
    }
    for (var s = 0; s < 4; s++) {
      el = document.createElement("span");
      el.className = "mk-slot";
      el.textContent = String(s);
      slotsEl.appendChild(el);
    }
  }

  function srcTitleA() {
    return t(stateA === "norm" ? "mk.aTitleNorm" : "mk.aTitleTrans");
  }

  function srcTitleB() {
    return t(stateB === "norm" ? "mk.bTitleNorm" : "mk.bTitleTrans");
  }

  function pathA() {
    return t(stateA === "norm" ? "mk.pathGather" : "mk.pathStride");
  }

  function pathB() {
    return t(stateB === "norm" ? "mk.pathStride" : "mk.pathGather");
  }

  /* Sources are the same logical matrices shown in whatever layout they are stored in. */
  function renderSources() {
    var i;
    if (stateA === "norm") {
      srcAEl.className = "mk-cells mk-src-a-norm";
      for (i = 0; i < M; i++) {
        for (var k = 0; k < K; k++) {
          srcAEl.children[i * K + k].textContent = String(A[i][k]);
        }
      }
      srcAEl.setAttribute("aria-label", fill(t("mk.aSrcNormAria"), { m: M, k: K }));
    } else {
      srcAEl.className = "mk-cells mk-src-a-trans";
      for (k = 0; k < K; k++) {
        for (i = 0; i < M; i++) {
          srcAEl.children[k * M + i].textContent = String(A[i][k]);
        }
      }
      srcAEl.setAttribute("aria-label", fill(t("mk.aSrcTransAria"), { m: M, k: K }));
    }
    if (stateB === "norm") {
      srcBEl.className = "mk-cells mk-src-b-norm";
      for (k = 0; k < K; k++) {
        for (var n = 0; n < N; n++) {
          srcBEl.children[k * N + n].textContent = String(B[k][n]);
        }
      }
      srcBEl.setAttribute("aria-label", fill(t("mk.bSrcNormAria"), { k: K, n: N }));
    } else {
      srcBEl.className = "mk-cells mk-src-b-trans";
      for (n = 0; n < N; n++) {
        for (k = 0; k < K; k++) {
          srcBEl.children[n * K + k].textContent = String(B[k][n]);
        }
      }
      srcBEl.setAttribute("aria-label", fill(t("mk.bSrcTransAria"), { k: K, n: N }));
    }
    aTitleEl.textContent = srcTitleA();
    bTitleEl.textContent = srcTitleB();
    pathAEl.textContent = pathA();
    pathBEl.textContent = pathB();
  }

  function cVal(m, n) {
    var v = 0;
    for (var k = 0; k < K; k++) v += A[m][k] * B[k][n];
    return v;
  }

  function labelC(cell, r, c, v) {
    cell.setAttribute("aria-label", fill(t("mk.cellAria"), { r: r, c: c, value: v }));
  }

  function clearTransient() {
    root
      .querySelectorAll(".mk-cell.is-live, .mk-cell.is-armed, .mk-cell.is-hot")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-armed", "is-hot");
      });
  }

  function clearAll() {
    root.querySelectorAll(".mk-cell").forEach(function (node) {
      node.classList.remove("is-live", "is-armed", "is-hot", "is-done", "is-read");
    });
    root.querySelectorAll(".mk-slot").forEach(function (node) {
      node.classList.remove("is-live", "is-done");
    });
  }

  function reset() {
    clearAll();
    renderSources();
    var i;
    for (i = 0; i < panelAEl.children.length; i++) {
      panelAEl.children[i].textContent = "·";
    }
    for (i = 0; i < panelBEl.children.length; i++) {
      panelBEl.children[i].textContent = "·";
    }
    zCells.a.forEach(function (half) {
      half.forEach(function (cell) {
        cell.textContent = "·";
      });
    });
    zCells.b.forEach(function (half) {
      half.forEach(function (cell) {
        cell.textContent = "·";
      });
    });
    zaCells.forEach(function (rows) {
      rows.forEach(function (row) {
        row.forEach(function (cell) {
          var value = cell.querySelector(".cell-value");
          value.textContent = "0";
          labelC(cell, +cell.getAttribute("data-r"), +cell.getAttribute("data-c"), 0);
        });
      });
    });
    if (cBadgeEl) cBadgeEl.hidden = true;
  }

  /* One committed step, drawn without transient marks. */
  function applyStep(step) {
    if (step.t === "pack") {
      var src = step.m === "a" ? srcAEl : srcBEl;
      var panel = step.m === "a" ? panelAEl : panelBEl;
      Array.prototype.forEach.call(src.children, function (cell) {
        cell.classList.add("is-read");
      });
      for (var k = 0; k < K; k++) {
        for (var i = 0; i < M; i++) {
          var panelCell = panel.children[k * M + i];
          panelCell.textContent = String(step.m === "a" ? A[i][k] : B[k][i]);
          panelCell.classList.add("is-done");
        }
      }
      return;
    }
    if (step.t === "load") {
      var kk = step.k;
      for (var m = 0; m < M; m++) {
        panelAEl.children[kk * M + m].classList.add("is-read");
        zCells.a[m < 4 ? 0 : 1][m % 4].textContent = String(A[m][kk]);
        zCells.a[m < 4 ? 0 : 1][m % 4].classList.add("is-done");
      }
      for (var n = 0; n < N; n++) {
        panelBEl.children[kk * N + n].classList.add("is-read");
        zCells.b[n < 4 ? 0 : 1][n % 4].textContent = String(B[kk][n]);
        zCells.b[n < 4 ? 0 : 1][n % 4].classList.add("is-done");
      }
      slotsEl.children[kk].classList.add("is-live");
      return;
    }
    if (step.t === "fmopa") {
      var fk = step.k;
      for (var r = 0; r < M; r++) {
        for (var c = 0; c < N; c++) {
          var cell = zaCells[Math.floor(r / 4) * 2 + Math.floor(c / 4)][r % 4][c % 4];
          var total = 0;
          for (var q = 0; q <= fk; q++) total += A[r][q] * B[q][c];
          cell.querySelector(".cell-value").textContent = String(total);
          labelC(cell, r, c, total);
          cell.classList.add("is-done");
        }
      }
      slotsEl.children[fk].classList.remove("is-live");
      slotsEl.children[fk].classList.add("is-done");
      return;
    }
    if (step.t === "store") {
      if (cBadgeEl) cBadgeEl.hidden = false;
    }
  }

  function drawPrefix(count) {
    reset();
    for (var i = 0; i < count; i++) applyStep(steps[i]);
  }

  buildGrids();

  var player = window.simdPlayer({
    steps: steps,
    gapMs: 340,
    onReset: function () {
      drawPrefix(0);
    },
    onArm: function (step) {
      clearTransient();
      if (step.t === "pack") {
        var src = step.m === "a" ? srcAEl : srcBEl;
        var panel = step.m === "a" ? panelAEl : panelBEl;
        Array.prototype.forEach.call(src.children, function (cell) {
          cell.classList.add("is-live");
        });
        Array.prototype.forEach.call(panel.children, function (cell) {
          cell.classList.add("is-armed");
        });
      } else if (step.t === "load") {
        var k = step.k;
        for (var m = 0; m < M; m++) {
          panelAEl.children[k * M + m].classList.add("is-live");
          zCells.a[m < 4 ? 0 : 1][m % 4].classList.add("is-armed");
        }
        for (var n = 0; n < N; n++) {
          panelBEl.children[k * N + n].classList.add("is-live");
          zCells.b[n < 4 ? 0 : 1][n % 4].classList.add("is-armed");
        }
      } else if (step.t === "fmopa") {
        zCells.a.forEach(function (half) {
          half.forEach(function (cell) {
            cell.classList.add("is-live");
          });
        });
        zCells.b.forEach(function (half) {
          half.forEach(function (cell) {
            cell.classList.add("is-live");
          });
        });
        root.querySelectorAll(".mk-tiles .cell").forEach(function (cell) {
          cell.classList.add("is-armed");
        });
      } else if (step.t === "store") {
        root.querySelectorAll(".mk-tiles .cell").forEach(function (cell) {
          cell.classList.add("is-live");
        });
      }
    },
    onCommit: function (step) {
      if (step.t === "pack") {
        var src = step.m === "a" ? srcAEl : srcBEl;
        Array.prototype.forEach.call(src.children, function (cell) {
          cell.classList.remove("is-live");
          cell.classList.add("is-read");
        });
        applyStep(step);
      } else if (step.t === "load") {
        var k = step.k;
        for (var m = 0; m < M; m++) {
          panelAEl.children[k * M + m].classList.remove("is-live");
          var za = zCells.a[m < 4 ? 0 : 1][m % 4];
          za.textContent = String(A[m][k]);
          za.classList.remove("is-armed");
          za.classList.add("is-hot");
        }
        for (var n = 0; n < N; n++) {
          panelBEl.children[k * N + n].classList.remove("is-live");
          var zb = zCells.b[n < 4 ? 0 : 1][n % 4];
          zb.textContent = String(B[k][n]);
          zb.classList.remove("is-armed");
          zb.classList.add("is-hot");
        }
        slotsEl.children[k].classList.add("is-live");
      } else if (step.t === "fmopa") {
        var fk = step.k;
        for (var r = 0; r < M; r++) {
          for (var c = 0; c < N; c++) {
            var cell = zaCells[Math.floor(r / 4) * 2 + Math.floor(c / 4)][r % 4][c % 4];
            var total = 0;
            for (var q = 0; q <= fk; q++) total += A[r][q] * B[q][c];
            cell.querySelector(".cell-value").textContent = String(total);
            labelC(cell, r, c, total);
            cell.classList.remove("is-armed");
            cell.classList.add("is-hot");
          }
        }
        slotsEl.children[fk].classList.remove("is-live");
        slotsEl.children[fk].classList.add("is-done");
      } else if (step.t === "store") {
        if (cBadgeEl) cBadgeEl.hidden = false;
      }
    },
    onSeek: function (count) {
      drawPrefix(count);
    },
    onApplyAll: function () {
      drawPrefix(steps.length);
    },
    onFinish: function () {
      clearTransient();
      drawPrefix(steps.length);
      announce(t("mk.done"));
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
      caption.textContent = t("mk.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("mk.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "mk.idle");
    } else if (step.t === "pack") {
      caption.textContent = t(step.m === "a" ? (stateA === "norm" ? "mk.packA.gather" : "mk.packA.copy") : stateB === "norm" ? "mk.packB.copy" : "mk.packB.gather");
    } else if (step.t === "load") {
      caption.textContent = fill(t("mk.load"), step);
    } else if (step.t === "fmopa") {
      caption.textContent = fill(t("mk.fmopa"), step);
    } else {
      caption.textContent = t("mk.store");
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

  function syncSeg() {
    root.querySelectorAll("[data-mk-a]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-mk-a") === stateA ? "true" : "false");
    });
    root.querySelectorAll("[data-mk-b]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-mk-b") === stateB ? "true" : "false");
    });
  }

  function reconfigure() {
    steps = buildSteps();
    player.setSteps(steps);
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = t("mk.values");
  }

  function renderAll() {
    renderSources();
    updateValuesLine();
    render();
  }

  root.querySelectorAll("[data-mk-a]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = button.getAttribute("data-mk-a");
      if (next === stateA) return;
      stateA = next;
      syncSeg();
      reconfigure();
      announce(t("ui.annReset"));
    });
  });

  root.querySelectorAll("[data-mk-b]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = button.getAttribute("data-mk-b");
      if (next === stateB) return;
      stateB = next;
      syncSeg();
      reconfigure();
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      A = A.map(function (row) {
        return row.map(function () {
          return Math.floor(Math.random() * 3);
        });
      });
      B = B.map(function (row) {
        return row.map(function () {
          return Math.floor(Math.random() * 3);
        });
      });
      reconfigure();
      announce(t("ui.annRandom"));
    });
  }

  window.simdControls({ root: root, player: player });

  syncSeg();
  renderAll();

  document.addEventListener("site-lang", renderAll);
})();
