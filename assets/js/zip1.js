/* SVE ZIP1, drawn at SVL = 128 bits: four .s lanes per vector.
   z0 interleaves the low half: z1[0], z2[0], z1[1], z2[1].
   The high half (lanes 2 and 3) stays put. No predicate. */
(function () {
  "use strict";

  var root = document.querySelector("[data-zip1]");
  if (!root) return;

  var Z1 = [1, 3, 8, 9];
  var Z2 = [2, 4, 7, 6];

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

  function laneAt(name, lane) {
    return root.querySelector('[data-vec="' + name + '"][data-lane="' + lane + '"]');
  }

  function labelLane(node, lane, value) {
    node.setAttribute("aria-label", fill(t("zip1.laneAria"), { lane: lane, value: value }));
  }

  function buildSteps() {
    var pairs = [
      { from: "z1", srcLane: 0 },
      { from: "z2", srcLane: 0 },
      { from: "z1", srcLane: 1 },
      { from: "z2", srcLane: 1 }
    ];
    return pairs.map(function (pair, i) {
      var value = (pair.from === "z1" ? Z1 : Z2)[pair.srcLane];
      return { i: i, from: pair.from, srcLane: pair.srcLane, value: value };
    });
  }

  var steps = buildSteps();

  function paintSources() {
    [Z1, Z2].forEach(function (values, index) {
      var name = index === 0 ? "z1" : "z2";
      values.forEach(function (value, lane) {
        var node = laneAt(name, lane);
        if (node) node.textContent = String(value);
      });
    });
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("zip1.values"), {
      z1: "{" + Z1.join(", ") + "}",
      z2: "{" + Z2.join(", ") + "}"
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
    root.querySelectorAll(".is-live, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-armed");
    });
  }

  function markSources(step) {
    var src = laneAt(step.from, step.srcLane);
    if (src) src.classList.add("is-live");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var node = laneAt("z0", i);
      node.textContent = "·";
      labelLane(node, i, t("zip1.laneEmpty"));
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var lane = laneAt("z0", step.i);
      lane.textContent = String(step.value);
      labelLane(lane, step.i, step.value);
      lane.classList.add("is-done");
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastLane = laneAt("z0", last.i);
      lastLane.classList.remove("is-done");
      lastLane.classList.add("is-hot");
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
      var hot = root.querySelector('[data-vec="z0"].is-hot');
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      markSources(step);
      laneAt("z0", step.i).classList.add("is-armed");
    },
    onCommit: function (step) {
      var lane = laneAt("z0", step.i);
      lane.classList.remove("is-armed");
      lane.classList.add("is-hot");
      lane.textContent = String(step.value);
      labelLane(lane, step.i, step.value);
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector('[data-vec="z0"].is-hot');
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      announce(t("zip1.done"));
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
      caption.textContent = t("zip1.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("zip1.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "zip1.idle");
    } else {
      caption.textContent = fill(t("zip1.stepCaption"), step);
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
    updateValuesLine();
    relabel();
    render();
  }

  function relabel() {
    for (var i = 0; i < 4; i++) {
      var lane = laneAt("z0", i);
      if (lane) {
        labelLane(lane, i, lane.textContent === "·" ? t("zip1.laneEmpty") : lane.textContent);
      }
    }
  }

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      Z1 = Z1.map(function () {
        return Math.floor(Math.random() * 10);
      });
      Z2 = Z2.map(function () {
        return Math.floor(Math.random() * 10);
      });
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

  document.addEventListener("site-lang", renderAll);
})();
