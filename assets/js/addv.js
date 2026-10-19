/* SVE ADDV, drawn at SVL = 128 bits: four .s lanes collapsing into d0.
   d0 = sum of z0.s[i] over lanes where p0[i] is active; inactive lanes
   join nothing. The accumulator is shown as a running total. */
(function () {
  "use strict";

  var root = document.querySelector("[data-addv]");
  if (!root) return;

  var Z0 = [3, 1, 4, 2];
  var P0 = [1, 1, 0, 1];

  var playBtn = root.querySelector("[data-action='play']");
  var randomBtn = root.querySelector("[data-action='random']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var acc = root.querySelector("[data-acc]");
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

  function labelAcc(value) {
    acc.setAttribute("aria-label", fill(t("addv.dAriaValue"), { value: value }));
  }

  function buildSteps() {
    var list = [];
    var total = 0;
    for (var i = 0; i < 4; i++) {
      var active = P0[i] === 1;
      var before = total;
      if (active) total += Z0[i];
      list.push({
        lane: i,
        a: Z0[i],
        active: active,
        before: before,
        after: total
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    Z0.forEach(function (value, lane) {
      var node = laneAt(lane);
      if (node) node.textContent = String(value);
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
    valuesLine.textContent = fill(t("addv.values"), { z0: "{" + Z0.join(", ") + "}" });
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
    var lane = laneAt(step.lane);
    if (lane) lane.classList.add(step.active ? "is-live" : "is-dead");
    var pred = root.querySelector('[data-pred="0"][data-lane="' + step.lane + '"]');
    if (pred) pred.classList.add(step.active ? "is-live" : "is-dead");
  }

  function drawState(count, hotLast) {
    clearFlags();
    acc.textContent = "0";
    labelAcc(0);
    for (var k = 0; k < count; k++) {
      var step = steps[k];
      if (step.active) {
        acc.textContent = String(step.after);
        labelAcc(step.after);
        laneAt(step.lane).classList.add("is-done");
      } else {
        laneAt(step.lane).classList.add("is-kept");
      }
    }
    if (hotLast && count > 0) {
      var last = steps[count - 1];
      if (last.active) acc.classList.add("is-hot");
      else acc.classList.add("is-kept");
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
      acc.classList.remove("is-hot", "is-kept");
      clearTransient();
      markSources(step);
      laneAt(step.lane).classList.add(step.active ? "is-armed" : "is-kept");
    },
    onCommit: function (step) {
      if (!step.active) return;
      laneAt(step.lane).classList.remove("is-armed");
      laneAt(step.lane).classList.add("is-done");
      acc.classList.add("is-hot");
      acc.textContent = String(step.after);
      labelAcc(step.after);
    },
    onSeek: function (count) {
      drawState(count, true);
    },
    onApplyAll: function () {
      drawState(steps.length, false);
    },
    onFinish: function () {
      acc.classList.remove("is-hot");
      acc.classList.add("is-done");
      clearTransient();
      announce(fill(t("addv.done"), { total: steps[steps.length - 1].after }));
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

  function totalText() {
    return fill(t("addv.done"), { total: steps[steps.length - 1].after });
  }

  function renderCaption(state, committed, armed) {
    if (!caption) return;
    if (state === "done") {
      caption.textContent = totalText();
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("addv.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "addv.idle");
    } else {
      caption.textContent = fill(t(step.active ? "addv.stepCaption" : "addv.skipCaption"), step);
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

  document.addEventListener("site-lang", function () {
  renderAll();
  /* The accumulator label is painted from the running total, so re-apply it
     for whatever is currently on screen. */
  drawState(player.getCommitted(), false);
});
})();
