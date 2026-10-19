/* SVE TBL, drawn at SVL = 128 bits: a two-register table of eight .s
   entries. Lane i gets table[Z3[i]] when the index is in range, and 0
   when it is not. Index lanes are clickable and cycle 0..9. */
(function () {
  "use strict";

  var root = document.querySelector("[data-tbl]");
  if (!root) return;

  var T1 = [5, 2, 9, 7]; /* table entries 0..3 */
  var T2 = [4, 8, 1, 6]; /* table entries 4..7 */
  var Z3 = [1, 8, 3, 9]; /* indices; 8 and 9 fall outside the table */
  var IDX_MAX = 9;

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

  function tableEntry(index) {
    return index < 4 ? T1[index] : T2[index - 4];
  }

  function tableNode(index) {
    var name = index < 4 ? "z1" : "z2";
    var lane = index % 4;
    return root.querySelector('[data-vec="' + name + '"][data-lane="' + lane + '"]');
  }

  function laneAt(lane) {
    return root.querySelector('[data-vec="z0"][data-lane="' + lane + '"]');
  }

  function labelLane(node, lane, value) {
    node.setAttribute("aria-label", fill(t("tbl.laneAria"), { lane: lane, value: value }));
  }

  function buildSteps() {
    var list = [];
    for (var i = 0; i < 4; i++) {
      var inRange = Z3[i] < 8;
      list.push({
        lane: i,
        idx: Z3[i],
        inRange: inRange,
        value: inRange ? tableEntry(Z3[i]) : 0,
        after: inRange ? tableEntry(Z3[i]) : 0
      });
    }
    return list;
  }

  var steps = buildSteps();

  function paintSources() {
    T1.forEach(function (value, lane) {
      var node = root.querySelector('[data-vec="z1"][data-lane="' + lane + '"]');
      if (node) node.textContent = String(value);
    });
    T2.forEach(function (value, lane) {
      var node = root.querySelector('[data-vec="z2"][data-lane="' + lane + '"]');
      if (node) node.textContent = String(value);
    });
  }

  function syncIdxButtons() {
    root.querySelectorAll("[data-idx]").forEach(function (button) {
      var lane = +button.getAttribute("data-idx");
      var value = Z3[lane];
      button.textContent = String(value);
      button.setAttribute("aria-pressed", value < 8 ? "true" : "false");
      button.setAttribute(
        "aria-label",
        fill(t("tbl.idxLaneAria"), { lane: lane, value: value })
      );
    });
  }

  function updateValuesLine() {
    if (!valuesLine) return;
    valuesLine.textContent = fill(t("tbl.values"), {
      z3: "{" + Z3.join(", ") + "}",
      t1: "{" + T1.join(", ") + "}",
      t2: "{" + T2.join(", ") + "}"
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
    if (step.inRange) {
      var entry = tableNode(step.idx);
      if (entry) entry.classList.add("is-live");
    }
    var button = root.querySelector('[data-idx="' + step.lane + '"]');
    if (button) button.classList.add(step.inRange ? "is-live" : "is-dead");
  }

  function drawState(count, hotLast) {
    clearFlags();
    for (var i = 0; i < 4; i++) {
      var node = laneAt(i);
      node.textContent = "·";
      /* The lane has no value yet: label it in the reader's language. */
      labelLane(node, i, t("tbl.laneEmpty"));
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
      var hot = root.querySelector('[data-vec="z0"].is-hot');
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
      var hot = root.querySelector('[data-vec="z0"].is-hot');
      if (hot) {
        hot.classList.remove("is-hot");
        hot.classList.add("is-done");
      }
      clearTransient();
      announce(t("tbl.done"));
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
      caption.textContent = t("tbl.done");
      return;
    }
    var step = state === "playing" && armed >= 0 ? steps[armed] : committed > 0 ? steps[committed - 1] : null;
    if (state !== "playing" && state !== "paused") {
      caption.textContent = t("tbl.idle");
    } else if (!step) {
      caption.textContent = t(state === "playing" ? "ui.starting" : "tbl.idle");
    } else {
      caption.textContent = fill(t(step.inRange ? "tbl.stepCaption" : "tbl.skipCaption"), step);
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
    syncIdxButtons();
    updateValuesLine();
    relabel();
    render();
  }

  /* Labels carry the language; re-derive them from what the picture shows,
     so a language switch does not leave them behind in the old one. */
  function relabel() {
    for (var i = 0; i < 4; i++) {
      var lane = laneAt(i);
      if (lane) {
        labelLane(lane, i, lane.textContent === "·" ? t("tbl.laneEmpty") : lane.textContent);
      }
    }
  }

  root.querySelectorAll("[data-idx]").forEach(function (button) {
    button.addEventListener("click", function () {
      var lane = +button.getAttribute("data-idx");
      Z3[lane] = (Z3[lane] + 1) % (IDX_MAX + 1);
      syncIdxButtons();
      updateValuesLine();
      steps = buildSteps();
      player.setSteps(steps);
      announce(t("ui.annReset"));
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      T1 = T1.map(function () {
        return Math.floor(Math.random() * 10);
      });
      T2 = T2.map(function () {
        return Math.floor(Math.random() * 10);
      });
      Z3 = Z3.map(function () {
        return Math.floor(Math.random() * (IDX_MAX + 1));
      });
      paintSources();
      renderAll();
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
