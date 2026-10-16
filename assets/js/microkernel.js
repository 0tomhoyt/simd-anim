/* A GEMM microkernel in its smallest honest form, following unigemm_sme:
   C (4×4, one ZA tile) = A (4×2) × B (2×4), two k groups, two load slots.
   The animation is a guided walk: pack reads and writes (two routes), then
   the layout-independent loop (ldr + fmopa), then the store. The A/B layout
   toggles only change how pack READS; everything downstream is identical. */
(function () {
  "use strict";

  var root = document.querySelector("[data-mk]");
  if (!root) return;

  var M = 4;
  var N = 4;
  var K = 2;

  var A = [
    [1, 2],
    [0, 1],
    [2, 1],
    [1, 0]
  ];
  var B = [
    [1, 2, 0, 1],
    [2, 0, 1, 1]
  ];
  var stateA = "norm"; /* norm = M×K row-major, trans = K×M */
  var stateB = "norm"; /* norm = K×N row-major, trans = N×K */

  var flow = root.querySelector(".mk-flow");
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
  var zAEl = root.querySelector('[data-z="a"]');
  var zBEl = root.querySelector('[data-z="b"]');
  var boxA = srcAEl.closest(".mk-box");
  var boxAPanel = panelAEl.closest(".mk-box");
  var boxB = srcBEl.closest(".mk-box");
  var boxBPanel = panelBEl.closest(".mk-box");
  var boxLoop = root.querySelector("[data-box-loop]");
  var boxC = root.querySelector("[data-box-c]");
  var zCells = { a: [], b: [] };
  var zaRefs = []; /* zaRefs[r][c] */
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
    return [
      { t: "pack", m: "a", phase: "read" },
      { t: "pack", m: "a", phase: "write" },
      { t: "pack", m: "b", phase: "read" },
      { t: "pack", m: "b", phase: "write" },
      { t: "load", k: 0, g: 1 },
      { t: "fmopa", k: 0, g: 1 },
      { t: "load", k: 1, g: 2 },
      { t: "fmopa", k: 1, g: 2 },
      { t: "store" }
    ];
  }

  var steps = buildSteps();

  function mkCell(text) {
    var el = document.createElement("span");
    el.className = "mk-cell";
    el.textContent = text;
    return el;
  }

  function buildGrids() {
    var i;
    for (i = 0; i < M * K; i++) srcAEl.appendChild(mkCell("0"));
    for (i = 0; i < K * N; i++) srcBEl.appendChild(mkCell("0"));
    for (i = 0; i < M * K; i++) panelAEl.appendChild(mkCell("·"));
    for (i = 0; i < K * N; i++) panelBEl.appendChild(mkCell("·"));
    ["a", "b"].forEach(function (name) {
      var host = root.querySelector('[data-z="' + name + '"]');
      for (var n = 0; n < M; n++) {
        var el = mkCell("·");
        host.appendChild(el);
        zCells[name].push(el);
      }
    });
    var grid = root.querySelector('[data-za="0"]');
    for (var r = 0; r < M; r++) {
      var row = [];
      for (var c = 0; c < N; c++) {
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("data-r", r);
        cell.setAttribute("data-c", c);
        var wash = document.createElement("span");
        wash.className = "wash";
        wash.setAttribute("aria-hidden", "true");
        var idx = document.createElement("span");
        idx.className = "cell-index";
        idx.textContent = r + "," + c;
        var val = document.createElement("span");
        val.className = "cell-value";
        val.textContent = "0";
        cell.appendChild(wash);
        cell.appendChild(idx);
        cell.appendChild(val);
        grid.appendChild(cell);
        row.push(cell);
      }
      zaRefs.push(row);
    }
    for (var s = 0; s < K; s++) {
      var slot = document.createElement("span");
      slot.className = "mk-slot";
      slot.textContent = String(s);
      slotsEl.appendChild(slot);
    }
  }

  /* The example run: which panel column we build, and where its values
     come from in the source. */
  function srcPattern(which) {
    var el = which === "a" ? srcAEl : srcBEl;
    var state = which === "a" ? stateA : stateB;
    var cols = which === "a" ? (state === "norm" ? K : M) : state === "norm" ? N : K;
    var cells = el.children;
    var out = [];
    var i;
    if ((which === "a" && state === "norm") || (which === "b" && state === "trans")) {
      /* gather: one element from each row — a source column */
      for (i = 0; i < cells.length; i += cols) out.push(cells[i]);
    } else {
      /* copy: one contiguous source row */
      for (i = 0; i < cols; i++) out.push(cells[i]);
    }
    return out;
  }

  function panelColPattern(el, k) {
    var cols = K;
    var out = [];
    for (var m = 0; m < M; m++) out.push(el.children[m * cols + k]);
    return out;
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

  function renderSources() {
    var i;
    var k;
    if (stateA === "norm") {
      srcAEl.className = "mk-cells mk-src-a-norm";
      for (i = 0; i < M; i++) {
        for (k = 0; k < K; k++) {
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

  function labelC(cell, r, c, v) {
    cell.setAttribute("aria-label", fill(t("mk.cellAria"), { r: r, c: c, value: v }));
  }

  function clearTransient() {
    flow.classList.remove("has-focus");
    root.querySelectorAll(".mk-box.is-focus").forEach(function (node) {
      node.classList.remove("is-focus");
    });
    root.querySelectorAll(".mk-cell.is-live, .mk-cell.is-armed, .mk-cell.is-hot, .mk-cell.is-pattern").forEach(function (node) {
      node.classList.remove("is-live", "is-armed", "is-hot", "is-pattern");
    });
  }

  function clearAll() {
    clearTransient();
    root.querySelectorAll(".mk-cell").forEach(function (node) {
      node.classList.remove("is-done", "is-read");
    });
    root.querySelectorAll(".mk-slot").forEach(function (node) {
      node.classList.remove("is-live", "is-done");
    });
  }

  function focus(boxes) {
    flow.classList.add("has-focus");
    boxes.forEach(function (box) {
      if (box) box.classList.add("is-focus");
    });
  }

  function reset() {
    clearAll();
    renderSources();
    var i;
    for (i = 0; i < panelAEl.children.length; i++) panelAEl.children[i].textContent = "·";
    for (i = 0; i < panelBEl.children.length; i++) panelBEl.children[i].textContent = "·";
    zCells.a.forEach(function (cell) {
      cell.textContent = "·";
    });
    zCells.b.forEach(function (cell) {
      cell.textContent = "·";
    });
    zaRefs.forEach(function (row) {
      row.forEach(function (cell) {
        var value = cell.querySelector(".cell-value");
        value.textContent = "0";
        labelC(cell, +cell.getAttribute("data-r"), +cell.getAttribute("data-c"), 0);
      });
    });
    if (cBadgeEl) cBadgeEl.hidden = true;
  }

  function fillPanel(el, which) {
    var k;
    var i;
    for (k = 0; k < K; k++) {
      for (i = 0; i < M; i++) {
        var panelCell = el.children[i * K + k];
        panelCell.textContent = String(which === "a" ? A[i][k] : B[k][i]);
        panelCell.classList.add("is-done");
      }
    }
  }

  function applyStep(step) {
    if (step.t === "pack") {
      var src = step.m === "a" ? srcAEl : srcBEl;
      var panel = step.m === "a" ? panelAEl : panelBEl;
      srcPattern(step.m).forEach(function (cell) {
        cell.classList.add("is-pattern");
      });
      if (step.phase === "read") {
        Array.prototype.forEach.call(src.children, function (cell) {
          cell.classList.add("is-read");
        });
      } else {
        fillPanel(panel, step.m);
        panelColPattern(panel, 0).forEach(function (cell) {
          cell.classList.add("is-pattern");
        });
      }
      return;
    }
    if (step.t === "load") {
      var k = step.k;
      panelColPattern(panelAEl, k).forEach(function (cell) {
        cell.classList.add("is-read");
      });
      panelColPattern(panelBEl, k).forEach(function (cell) {
        cell.classList.add("is-read");
      });
      for (var m = 0; m < M; m++) {
        zCells.a[m].textContent = String(A[m][k]);
        zCells.a[m].classList.add("is-done");
      }
      for (var n = 0; n < N; n++) {
        zCells.b[n].textContent = String(B[k][n]);
        zCells.b[n].classList.add("is-done");
      }
      slotsEl.children[k].classList.add("is-live");
      return;
    }
    if (step.t === "fmopa") {
      for (var r = 0; r < M; r++) {
        for (var c = 0; c < N; c++) {
          var cell = zaRefs[r][c];
          var total = 0;
          for (var q = 0; q <= step.k; q++) total += A[r][q] * B[q][c];
          cell.querySelector(".cell-value").textContent = String(total);
          labelC(cell, r, c, total);
          cell.classList.add("is-done");
        }
      }
      slotsEl.children[step.k].classList.remove("is-live");
      slotsEl.children[step.k].classList.add("is-done");
      return;
    }
    if (step.t === "store" && cBadgeEl) {
      cBadgeEl.hidden = false;
    }
  }

  function seekFocus(step) {
    if (!step) return;
    if (step.t === "pack" && step.phase === "read") {
      focus([step.m === "a" ? boxA : boxB]);
    } else if (step.t === "pack") {
      focus([step.m === "a" ? boxA : boxB, step.m === "a" ? boxAPanel : boxBPanel]);
    } else if (step.t === "load") {
      focus([boxAPanel, boxBPanel, boxLoop]);
    } else if (step.t === "fmopa") {
      focus([boxLoop, boxC]);
    } else {
      focus([boxC]);
    }
  }

  function drawPrefix(count) {
    reset();
    for (var i = 0; i < count; i++) applyStep(steps[i]);
    if (count > 0) seekFocus(steps[count - 1]);
  }

  buildGrids();

  var player = window.simdPlayer({
    steps: steps,
    gapMs: 360,
    onReset: function () {
      drawPrefix(0);
    },
    onArm: function (step) {
      clearTransient();
      if (step.t === "pack") {
        var src = step.m === "a" ? srcAEl : srcBEl;
        var panel = step.m === "a" ? panelAEl : panelBEl;
        if (step.phase === "read") {
          focus([step.m === "a" ? boxA : boxB]);
          Array.prototype.forEach.call(src.children, function (cell) {
            cell.classList.add("is-live");
          });
          srcPattern(step.m).forEach(function (cell) {
            cell.classList.add("is-pattern");
          });
        } else {
          focus([step.m === "a" ? boxA : boxB, step.m === "a" ? boxAPanel : boxBPanel]);
          Array.prototype.forEach.call(panel.children, function (cell) {
            cell.classList.add("is-armed");
          });
          srcPattern(step.m).forEach(function (cell) {
            cell.classList.add("is-pattern");
          });
        }
      } else if (step.t === "load") {
        focus([boxAPanel, boxBPanel, boxLoop]);
        panelColPattern(panelAEl, step.k).forEach(function (cell) {
          cell.classList.add("is-live");
        });
        panelColPattern(panelBEl, step.k).forEach(function (cell) {
          cell.classList.add("is-live");
        });
        zCells.a.forEach(function (cell) {
          cell.classList.add("is-armed");
        });
        zCells.b.forEach(function (cell) {
          cell.classList.add("is-armed");
        });
      } else if (step.t === "fmopa") {
        focus([boxLoop, boxC]);
        zCells.a.forEach(function (cell) {
          cell.classList.add("is-live");
        });
        zCells.b.forEach(function (cell) {
          cell.classList.add("is-live");
        });
        zaRefs.forEach(function (row) {
          row.forEach(function (cell) {
            cell.classList.add("is-armed");
          });
        });
      } else if (step.t === "store") {
        focus([boxC]);
        zaRefs.forEach(function (row) {
          row.forEach(function (cell) {
            cell.classList.add("is-live");
          });
        });
      }
    },
    onCommit: function (step) {
      if (step.t === "pack") {
        var src = step.m === "a" ? srcAEl : srcBEl;
        if (step.phase === "read") {
          Array.prototype.forEach.call(src.children, function (cell) {
            cell.classList.remove("is-live");
            cell.classList.add("is-read");
          });
        } else {
          var panel = step.m === "a" ? panelAEl : panelBEl;
          Array.prototype.forEach.call(panel.children, function (cell) {
            cell.classList.remove("is-armed");
          });
          fillPanel(panel, step.m);
        }
      } else if (step.t === "load") {
        var k = step.k;
        for (var m = 0; m < M; m++) {
          zCells.a[m].textContent = String(A[m][k]);
          zCells.a[m].classList.remove("is-armed");
          zCells.a[m].classList.add("is-hot");
          zCells.b[m].textContent = String(B[k][m]);
          zCells.b[m].classList.remove("is-armed");
          zCells.b[m].classList.add("is-hot");
        }
        panelColPattern(panelAEl, k).forEach(function (cell) {
          cell.classList.remove("is-live");
        });
        panelColPattern(panelBEl, k).forEach(function (cell) {
          cell.classList.remove("is-live");
        });
        slotsEl.children[k].classList.add("is-live");
      } else if (step.t === "fmopa") {
        for (var r = 0; r < M; r++) {
          for (var c = 0; c < N; c++) {
            var cell = zaRefs[r][c];
            var total = 0;
            for (var q = 0; q <= step.k; q++) total += A[r][q] * B[q][c];
            cell.querySelector(".cell-value").textContent = String(total);
            labelC(cell, r, c, total);
            cell.classList.remove("is-armed");
            cell.classList.add("is-hot");
          }
        }
        slotsEl.children[step.k].classList.remove("is-live");
        slotsEl.children[step.k].classList.add("is-done");
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

  function packCaption(step) {
    var gatherA = stateA === "norm";
    var gatherB = stateB === "trans";
    if (step.m === "a") {
      if (step.phase === "read") return t(gatherA ? "mk.packA.read.gather" : "mk.packA.read.copy");
      return t(gatherA ? "mk.packA.write.gather" : "mk.packA.write.copy");
    }
    if (step.phase === "read") return t(gatherB ? "mk.packB.read.gather" : "mk.packB.read.copy");
    return t(gatherB ? "mk.packB.write.gather" : "mk.packB.write.copy");
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
      caption.textContent = packCaption(step);
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
