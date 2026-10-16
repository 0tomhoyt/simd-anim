/* SVE FMLA, drawn at SVL = 128 bits so each vector has four .s lanes.
   z0[i] += z1[i] * z2[i] when p0[i] is active; /m keeps it otherwise.
   Predicate bits are clickable and the vectors can be re-rolled. */
(function () {
  "use strict";

  var root = document.querySelector("[data-fmla]");
  if (!root) return;

  var Z0 = [1, 2, 0, 3];
  var Z1 = [2, 1, 3, 2];
  var Z2 = [1, 3, 2, 2];
  var P0 = [1, 1, 1, 1];

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
    node.setAttribute("aria-label", fill(t("fmla.laneAria"), { lane: lane, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var i = 0; i < 4; i++) {
      var active = P0[i] === 1;
      list.push({
        lane: i,
        a: Z1[i],
        b: Z2[i],
        active: active,
        before: Z0[i],
        after: active ? Z0[i] + Z1[i] * Z2[i] : Z0[i]
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    [Z1, Z2, Z0].forEach(function (values, index) {
      var name = ["z1", "z2", "z0"][index];
      values.forEach(function (value, lane) {
        var node = laneAt(name, lane);
        if (!node) return;
        node.textContent = String(value);
        if (name === "z0") labelLane(node, lane, value);
      });
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
    valuesLine.textContent = fill(t("fmla.values"), {
      z1: "{" + Z1.join(", ") + "}",
      z2: "{" + Z2.join(", ") + "}",
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

  /* Between steps only the transient marks go; done/kept marks accumulate. */
  function clearTransient() {
    root.querySelectorAll(".is-live, .is-dead, .is-armed").forEach(function (node) {
      node.classList.remove("is-live", "is-dead", "is-armed");
    });
  }

  function markSources(step) {
    var z1 = laneAt("z1", step.lane);
    var z2 = laneAt("z2", step.lane);
    if (z1) z1.classList.add("is-live");
    if (z2) z2.classList.add("is-live");
    var pred = root.querySelector('[data-pred="0"][data-lane="' + step.lane + '"]');
    if (pred) pred.classList.add(step.active ? "is-live" : "is-dead");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var node = laneAt("z0", i);
      node.classList.remove("is-done", "is-hot", "is-kept");
      node.textContent = String(Z0[i]);
      labelLane(node, i, Z0[i]);
    }
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      var lane = laneAt("z0", step.lane);
      if (step.active) {
        lane.textContent = String(step.after);
        labelLane(lane, step.lane, step.after);
        lane.classList.add("is-done");
      } else {
        lane.classList.add("is-kept");
      }
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      var lastLane = laneAt("z0", last.lane);
      if (last.active) {
        lastLane.classList.remove("is-done");
        lastLane.classList.add("is-hot");
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
      var hot = root.querySelector(".lane.is-hot");
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      markSources(step);
      laneAt("z0", step.lane).classList.add(step.active ? "is-armed" : "is-kept");
    },
    onCommit: function (step) {
      if (!step.active) return;
      var lane = laneAt("z0", step.lane);
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
      clearFlags();
      announce(t("fmla.done"));
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
      caption.textContent = t("fmla.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("fmla.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "fmla.idle");
    } else {
      caption.textContent = fill(t(step.active ? "fmla.stepCaption" : "fmla.skipCaption"), step);
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
      for (var i = 0; i < 4; i++) {
        Z0[i] = Math.floor(Math.random() * 4);
        Z1[i] = 1 + Math.floor(Math.random() * 3);
        Z2[i] = 1 + Math.floor(Math.random() * 3);
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

  document.addEventListener("site-lang", renderAll);
})();
