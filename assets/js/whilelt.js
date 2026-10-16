/* SVE WHILELT, drawn at SVL = 128 bits: four .s lanes, four predicate bits.
   p0[i] = (x0 + i) < x1. The scalars x0 and x1 are steerable live; the
   predicate here is the RESULT, not an input you click. */
(function () {
  "use strict";

  var root = document.querySelector("[data-whilelt]");
  if (!root) return;

  var X0 = 2;
  var X1 = 5;
  var X0_MIN = 0;
  var X0_MAX = 4;
  var X1_MIN = 0;
  var X1_MAX = 9;

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

  function scalarAt(lane) {
    return root.querySelector('[data-vec="x"][data-lane="' + lane + '"]');
  }

  function bitAt(lane) {
    return root.querySelector('[data-bit="' + lane + '"]');
  }

  function labelScalar(node, lane, value) {
    node.setAttribute("aria-label", fill(t("whilelt.laneAria"), { lane: lane, value: value }));
  }

  function labelBit(node, lane, bit) {
    node.setAttribute("aria-label", fill(t("whilelt.bitAria"), { lane: lane, bit: bit }));
  }

  function buildSteps() {
    var list = [];
    for (var i = 0; i < 4; i++) {
      list.push({
        lane: i,
        val: X0 + i,
        x1: X1,
        bit: X0 + i < X1 ? 1 : 0
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    for (var i = 0; i < 4; i++) {
      var node = scalarAt(i);
      node.textContent = String(X0 + i);
      labelScalar(node, i, X0 + i);
    }
    if (opline) opline.textContent = "< x1 = " + X1;
  }

  function syncSteppers() {
    var x0El = root.querySelector("[data-x0]");
    var x1El = root.querySelector("[data-x1]");
    if (x0El) x0El.textContent = String(X0);
    if (x1El) x1El.textContent = String(X1);
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("whilelt.values"), { x0: X0, x1: X1 });
  }

  function clearFlags() {
    root
      .querySelectorAll(".is-live, .is-dead, .is-armed, .is-hot, .is-done, .is-kept")
      .forEach(function (node) {
        node.classList.remove("is-live", "is-dead", "is-armed", "is-hot", "is-done", "is-kept");
      });
  }

  function clearTransient() {
    root.querySelectorAll(".is-live, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-armed");
    });
  }

  function markSources(step) {
    var scalar = scalarAt(step.lane);
    if (scalar) scalar.classList.add("is-live");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var bit = bitAt(i);
      bit.textContent = "·";
      labelBit(bit, i, "unknown");
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var node = bitAt(step.lane);
      node.textContent = String(step.bit);
      labelBit(node, step.lane, step.bit);
      node.classList.add("is-done");
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastBit = bitAt(last.lane);
      lastBit.classList.remove("is-done");
      lastBit.classList.add("is-hot");
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
      var hot = root.querySelector(".pred.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      markSources(step);
      bitAt(step.lane).classList.add("is-armed");
    },
    onCommit: function (step) {
      var bit = bitAt(step.lane);
      bit.classList.remove("is-armed");
      bit.classList.add("is-hot");
      bit.textContent = String(step.bit);
      labelBit(bit, step.lane, step.bit);
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector(".pred.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      announce(t("whilelt.done"));
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
      caption.textContent = t("whilelt.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("whilelt.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "whilelt.idle");
    } else {
      caption.textContent = fill(t(step.bit === 1 ? "whilelt.stepCaption" : "whilelt.skipCaption"), step);
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
    syncSteppers();
    updateValuesLine();
    render();
  }

  function reconfigure() {
    paintSources();
    updateValuesLine();
    steps = buildSteps();
    player.setSteps(steps);
  }

  root.querySelectorAll("[data-bump]").forEach(function (button) {
    button.addEventListener("click", function () {
      var parts = button.getAttribute("data-bump").split(":");
      var delta = +parts[1];
      if (parts[0] === "x0") {
        X0 = Math.min(X0_MAX, Math.max(X0_MIN, X0 + delta));
      } else {
        X1 = Math.min(X1_MAX, Math.max(X1_MIN, X1 + delta));
      }
      syncSteppers();
      reconfigure();
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      X0 = Math.floor(Math.random() * 4);
      X1 = X0 + Math.floor(Math.random() * 6);
      syncSteppers();
      reconfigure();
      announce(t("ui.annRandom"));
    });
  }

  window.simdControls({ root: root, player: player });

  paintSources();
  syncSteppers();
  renderAll();

  document.addEventListener("site-lang", renderAll);
})();
