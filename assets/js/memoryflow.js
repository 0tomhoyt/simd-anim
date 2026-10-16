/* Concept page: memory choreography across two microkernel calls.
   A four-row timeline (Core / L1 / L2 / HBM) filled slot by slot; each
   chip is one hop with its byte count, and the row meters show the
   per-slot bandwidth used against unigemm_sme's measured budgets. */
(function () {
  "use strict";

  var root = document.querySelector("[data-mflow]");
  if (!root) return;

  var ROWS = ["core", "l1", "l2", "hbm"];
  var BUDGET = { l1: 224, l2: 192, hbm: 64 };
  var MODE = "once"; /* once | acc */

  var playBtn = root.querySelector("[data-action='play']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var grid = root.querySelector("[data-mflow-grid]");
  var lastState = "idle";
  var cellRefs = {}; /* row -> [cell, ...] */
  var meterRefs = {};
  var useRefs = {};

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

  function R(n) {
    return t("mflow.read") + " " + n + " B";
  }

  function W(n) {
    return t("mflow.write") + " " + n + " B";
  }

  /* One step = one slot of the timeline. chips: row -> array of chip kinds. */
  function stepsFor(mode) {
    var s1 = { key: "mflow.s1", chips: { core: ["pack"], hbm: ["read"], l1: ["write"] } };
    var s2 = { key: "mflow.s2", chips: { core: ["pldl2keep"], hbm: ["read"], l2: ["flight"] } };
    var s3 = { key: "mflow.s3", chips: { core: ["ldr + fmopa k0"], l1: ["read"], l2: ["write"] } };
    var s4 = { key: "mflow.s4", chips: { core: ["ldr + fmopa k1"], l2: ["read"], l1: ["write", "read"] } };
    var s5 = { key: "mflow.s5", chips: { core: ["pldl1strm"], hbm: ["read"], l1: ["stream"] } };
    var s6acc = { key: "mflow.s6acc", chips: { core: ["ldnt1w + fadd"], hbm: ["read"], l1: ["write"] } };
    var s7 = { key: "mflow.s7", chips: { core: ["st1w"], l1: ["write"] } };
    var s8 = { key: "mflow.s8", chips: { core: ["stnt1w"], l1: ["read"], hbm: ["write"] } };
    var s9 = { key: "mflow.s9", chips: { core: ["pack n+1"], hbm: ["read", "write"], l1: ["write"] } };
    var s10 = { key: "mflow.s10", chips: { core: ["pldl2keep"], hbm: ["read"], l2: ["flight", "done"] } };
    var s11 = { key: "mflow.s11", chips: { core: ["ldr + fmopa n+1"], l1: ["read"], l2: ["write"] } };
    if (mode === "acc") {
      return [s1, s2, s3, s4, s5, s6acc, s7, s8, s9, s10, s11];
    }
    return [s1, s2, s3, s4, s5, s7, s8, s9, s10, s11];
  }

  function bytesFor(kind) {
    if (kind === "read" || kind === "write" || kind === "flight" || kind === "stream" || kind === "done") return 64;
    return 0;
  }

  function meterUse(step, row) {
    var chips = step.chips[row] || [];
    var total = 0;
    chips.forEach(function (kind) {
      total += bytesFor(kind);
    });
    return total;
  }

  function chipEl(kind) {
    var el = document.createElement("span");
    el.className = "mflow-chip";
    if (kind === "read") {
      el.classList.add("is-read");
      el.textContent = R(64);
    } else if (kind === "write") {
      el.classList.add("is-write");
      el.textContent = W(64);
    } else if (kind === "flight") {
      el.classList.add("is-flight");
      el.textContent = t("mflow.inFlight");
    } else if (kind === "stream") {
      el.classList.add("is-flight");
      el.textContent = t("mflow.streaming");
    } else if (kind === "done") {
      el.classList.add("is-done");
      el.textContent = t("mflow.drained");
    } else {
      el.classList.add("is-op");
      el.textContent = kind;
    }
    return el;
  }

  function buildGrid() {
    grid.innerHTML = "";
    grid.dataset.steps = String(stepsFor(MODE).length);
    var band = document.createElement("div");
    band.className = "mflow-band";
    var n1 = document.createElement("p");
    n1.className = "mflow-band-k";
    var nSpan = MODE === "acc" ? 8 : 7;
    n1.style.gridColumn = "2 / " + (nSpan + 2);
    n1.textContent = t("mflow.kernelN");
    var n2 = document.createElement("p");
    n2.className = "mflow-band-k mflow-band-k2";
    n2.style.gridColumn = (nSpan + 2) + " / -1";
    n2.textContent = t("mflow.kernelN1");
    band.appendChild(n1);
    band.appendChild(n2);
    grid.appendChild(band);

    cellRefs = {};
    meterRefs = {};
    useRefs = {};
    var total = stepsFor(MODE).length;
    grid.style.gridTemplateColumns = "8.5rem repeat(" + total + ", minmax(3.4rem, auto))";
    ROWS.forEach(function (row) {
      var head = document.createElement("div");
      head.className = "mflow-head";
      var name = document.createElement("p");
      name.className = "mflow-name";
      name.textContent = t(row === "core" ? "mflow.rowCore" : row === "l1" ? "mflow.rowL1" : row === "l2" ? "mflow.rowL2" : "mflow.rowHbm");
      head.appendChild(name);
      if (BUDGET[row]) {
        var budget = document.createElement("p");
        budget.className = "mflow-budget";
        budget.textContent = fill(t("mflow.budget"), { b: BUDGET[row] });
        head.appendChild(budget);
        var meter = document.createElement("div");
        meter.className = "mflow-meter";
        var bar = document.createElement("i");
        bar.setAttribute("data-meter", row);
        meter.appendChild(bar);
        head.appendChild(meter);
        var use = document.createElement("p");
        use.className = "mflow-use";
        use.setAttribute("data-use", row);
        head.appendChild(use);
        meterRefs[row] = bar;
        useRefs[row] = use;
      } else {
        var quietNote = document.createElement("p");
        quietNote.className = "mflow-budget mflow-quietnote";
        quietNote.textContent = t("mflow.quiet");
        head.appendChild(quietNote);
      }
      grid.appendChild(head);
      var cells = [];
      for (var i = 0; i < total; i++) {
        var cell = document.createElement("div");
        cell.className = "mflow-cell";
        cell.setAttribute("data-slot", String(i));
        grid.appendChild(cell);
        cells.push(cell);
      }
      cellRefs[row] = cells;
    });
  }

  var steps = stepsFor(MODE);

  function setMeters(step) {
    var used = { l1: meterUse(step, "l1"), l2: meterUse(step, "l2"), hbm: meterUse(step, "hbm") };
    Object.keys(BUDGET).forEach(function (row) {
      var meters = meterRefs[row];
      if (!meters) return;
      var pct = Math.min(100, Math.round((used[row] / BUDGET[row]) * 100));
      meters.style.width = pct + "%";
      meters.classList.toggle("is-over", used[row] > BUDGET[row]);
      useRefs[row].textContent = used[row] + " / " + BUDGET[row];
      useRefs[row].classList.toggle("is-over", used[row] > BUDGET[row]);
    });
  }

  function reset() {
    grid.querySelectorAll(".mflow-chip").forEach(function (chip) {
      chip.remove();
    });
    grid.querySelectorAll(".mflow-cell").forEach(function (cell) {
      cell.classList.remove("is-done", "is-active");
    });
    setMeters({ chips: {} });
  }

  function applyStep(step, index) {
    ROWS.forEach(function (row) {
      var chips = step.chips[row] || [];
      chips.forEach(function (kind) {
        var cell = cellRefs[row][index];
        cell.appendChild(chipEl(kind));
        cell.classList.add("is-done");
      });
    });
  }

  function drawPrefix(count) {
    reset();
    for (var i = 0; i < count; i++) applyStep(steps[i], i);
    if (count > 0) setMeters(steps[count - 1]);
  }

  function highlightColumn(index) {
    grid.querySelectorAll(".mflow-cell").forEach(function (cell) {
      cell.classList.toggle("is-active", +cell.getAttribute("data-slot") === index);
    });
  }

  var player = window.simdPlayer({
    steps: steps,
    gapMs: 420,
    onReset: function () {
      drawPrefix(0);
      highlightColumn(-1);
    },
    onArm: function (step, index) {
      highlightColumn(index);
      setMeters(step);
    },
    onCommit: function (step, index) {
      applyStep(step, index);
    },
    onSeek: function (count) {
      drawPrefix(count);
      highlightColumn(count - 1);
    },
    onApplyAll: function () {
      drawPrefix(steps.length);
      highlightColumn(steps.length - 1);
    },
    onFinish: function () {
      announce(t("mflow.done"));
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
      caption.textContent = t("mflow.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("mflow.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "mflow.idle");
    } else {
      caption.textContent = t(step.key);
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

  function syncMode() {
    root.querySelectorAll("[data-mflow-mode]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-mflow-mode") === MODE ? "true" : "false");
    });
  }

  function reconfigure() {
    steps = stepsFor(MODE);
    buildGrid();
    player.setSteps(steps);
  }

  root.querySelectorAll("[data-mflow-mode]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = button.getAttribute("data-mflow-mode");
      if (next === MODE) return;
      MODE = next;
      syncMode();
      reconfigure();
      announce(t("ui.annReset"));
    });
  });

  window.simdControls({ root: root, player: player });

  buildGrid();
  syncMode();
  render();

  document.addEventListener("site-lang", function () {
    buildGrid();
    drawPrefix(player.getCommitted());
    render();
  });
})();
