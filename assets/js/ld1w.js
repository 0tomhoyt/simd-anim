/* SVE LD1W, drawn at SVL = 128 bits: four .s lanes, sixteen bytes of memory.
   Lane i gets mem[x0 + 4*i] when p0[i] is active; /z writes 0 otherwise,
   and an inactive lane reads no memory at all. */
(function () {
  "use strict";

  var root = document.querySelector("[data-ld1w]");
  if (!root) return;

  var MEM = [5, 7, 2, 9, 6, 4]; /* words 0..3 are the 16-byte window; 4..5 stay out */
  var Z0 = [3, 1, 4, 2]; /* garbage, so /z zeroing is visible */
  var P0 = [1, 1, 0, 1];

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

  function laneAt(lane) {
    return root.querySelector('[data-vec="z0"][data-lane="' + lane + '"]');
  }

  function memAt(index) {
    return root.querySelector('[data-mem="' + index + '"]');
  }

  function labelLane(node, lane, value) {
    node.setAttribute("aria-label", fill(t("ld1w.laneAria"), { lane: lane, value: value }));
  }

  function labelMem(node, index, value) {
    node.setAttribute("aria-label", fill(t("ld1w.memWordAria"), { index: index, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var i = 0; i < 4; i++) {
      var active = P0[i] === 1;
      list.push({
        lane: i,
        off: 4 * i,
        value: MEM[i],
        active: active,
        before: Z0[i],
        after: active ? MEM[i] : 0
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    MEM.forEach(function (value, index) {
      var node = memAt(index);
      if (node) {
        node.textContent = String(value);
        if (index < 4) labelMem(node, index, value);
      }
    });
    Z0.forEach(function (value, lane) {
      var node = laneAt(lane);
      if (node) {
        node.textContent = String(value);
        labelLane(node, lane, value);
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

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("ld1w.values"), {
      mem: "{" + MEM.slice(0, 4).join(", ") + "}",
      z0: "{" + Z0.join(", ") + "}"
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
    if (step.active) {
      var word = memAt(step.lane);
      if (word) word.classList.add("is-live");
    }
    var pred = root.querySelector('[data-pred="0"][data-lane="' + step.lane + '"]');
    if (pred) pred.classList.add(step.active ? "is-live" : "is-dead");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var node = laneAt(i);
      node.textContent = String(Z0[i]);
      labelLane(node, i, Z0[i]);
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var lane = laneAt(step.lane);
      lane.textContent = String(step.after);
      labelLane(lane, step.lane, step.after);
      lane.classList.add("is-done");
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastLane = laneAt(last.lane);
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
      var hot = root.querySelector(".lane.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      markSources(step);
      laneAt(step.lane).classList.add("is-armed");
    },
    onCommit: function (step) {
      var lane = laneAt(step.lane);
      lane.classList.remove("is-armed");
      lane.classList.add("is-hot");
      lane.textContent = String(step.after);
      labelLane(lane, step.lane, step.after);
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      var hot = root.querySelector(".lane.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      announce(t("ld1w.done"));
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
      caption.textContent = t("ld1w.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("ld1w.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "ld1w.idle");
    } else {
      caption.textContent = fill(t(step.active ? "ld1w.stepCaption" : "ld1w.skipCaption"), step);
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
      var lane = button.getAttribute("data-lane");
      P0[lane] = P0[lane] === 1 ? 0 : 1;
      syncPreds();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      MEM = MEM.map(function () {
        return Math.floor(Math.random() * 10);
      });
      Z0 = Z0.map(function () {
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
