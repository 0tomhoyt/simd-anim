/* Stable softmax on four scores. The steps are max, subtract, exp, normalize.
   Mild and sharp stay finite either way. The overflow preset sends a naive
   exp to Inf while exp(x − max) stays finite and the weights still sum to 1. */
(function () {
  "use strict";

  var root = document.querySelector("[data-smx]");
  if (!root) return;

  var PRESETS = {
    mild: [1.2, 0.3, 2.0, 0.7],
    sharp: [0.2, 0.4, 5.0, 0.1],
    hot: [1000, 1001, 998, 999]
  };
  var preset = "mild";
  var rows = [];
  var playBtn = root.querySelector("[data-action='play']");
  var caption = root.querySelector("[data-caption]");
  var naiveLine = root.querySelector("[data-naive]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var lastState = "idle";

  root.querySelectorAll("[data-smx-row]").forEach(function (row) {
    rows.push({
      row: row,
      x: row.querySelector('[data-smx="x"]'),
      shift: row.querySelector('[data-smx="shift"]'),
      exp: row.querySelector('[data-smx="exp"]'),
      w: row.querySelector('[data-smx="w"]'),
      fill: row.querySelector(".smx-fill")
    });
  });

  function t(key) {
    return window.siteI18n && window.siteI18n.t ? window.siteI18n.t(key) : key;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function fmtNum(x) {
    if (typeof x !== "number" || x !== x) return "·";
    if (!isFinite(x)) return "Inf";
    if (Math.abs(x) >= 100) return String(Math.round(x));
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toFixed(2);
  }

  function announce(message) {
    if (announcer) announcer.textContent = message;
  }

  function stats(xs) {
    var m = xs[0];
    var i;
    for (i = 1; i < xs.length; i++) if (xs[i] > m) m = xs[i];
    var shifted = [];
    var exps = [];
    var sum = 0;
    var naive = [];
    for (i = 0; i < xs.length; i++) {
      shifted.push(xs[i] - m);
      var e = Math.exp(xs[i] - m);
      exps.push(e);
      sum += e;
      naive.push(Math.exp(xs[i]));
    }
    var w = [];
    for (i = 0; i < exps.length; i++) w.push(exps[i] / sum);
    return { max: m, shifted: shifted, exps: exps, sum: sum, w: w, naive: naive };
  }

  function weightSum(w) {
    var s = 0;
    var i;
    for (i = 0; i < w.length; i++) s += w[i];
    if (Math.abs(s - 1) < 1e-6) return (1).toFixed(2);
    return fmtNum(s);
  }

  function draw(step) {
    var xs = PRESETS[preset];
    var st = stats(xs);
    var i;
    for (i = 0; i < xs.length; i++) {
      var isMax = Math.abs(xs[i] - st.max) < 1e-9;
      rows[i].row.classList.toggle("is-cur", step >= 1 && isMax);
      rows[i].x.textContent = fmtNum(xs[i]);
      rows[i].shift.textContent = step >= 2 ? fmtNum(st.shifted[i]) : "·";
      rows[i].shift.classList.toggle("is-on", step >= 2);
      rows[i].exp.textContent = step >= 3 ? fmtNum(st.exps[i]) : "·";
      rows[i].exp.classList.toggle("is-on", step >= 3);
      rows[i].w.textContent = step >= 4 ? fmtNum(st.w[i]) : "·";
      rows[i].w.classList.toggle("is-on", step >= 4);
      rows[i].fill.style.width = step >= 4 ? Math.max(4, Math.round(st.w[i] * 100)) + "%" : "0%";
    }
    if (naiveLine) {
      if (step >= 3) {
        var bad = st.naive.some(function (e) {
          return !isFinite(e);
        });
        naiveLine.hidden = false;
        naiveLine.textContent =
          fill(t("smx.naive"), { v: st.naive.map(fmtNum).join(" · ") }) +
          " — " +
          t(bad ? "smx.naive.inf" : "smx.naive.ok");
        naiveLine.classList.toggle("is-hot", bad);
      } else {
        naiveLine.hidden = true;
        naiveLine.textContent = "";
      }
    }
    return st;
  }

  function captionFor(step, st) {
    if (step <= 0) return t("smx.step.raw");
    if (step === 1) return fill(t("smx.step.max"), { m: fmtNum(st.max) });
    if (step === 2) return t("smx.step.shift");
    if (step === 3) return t("smx.step.exp");
    return fill(t("smx.step.norm"), { s: fmtNum(st.sum) }) + "  ·  " + fill(t("smx.sum"), { s: weightSum(st.w) });
  }

  var steps = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];
  var shown = 0;

  var player = window.simdPlayer({
    steps: steps,
    armMs: 460,
    gapMs: 280,
    onArm: function (_step, i) {
      shown = i + 1;
      draw(shown);
    },
    onCommit: function () {},
    onSeek: function (count) {
      shown = count;
      draw(shown);
    },
    onApplyAll: function () {
      shown = steps.length;
      draw(shown);
    },
    onReset: function () {
      shown = 0;
      draw(0);
    },
    onFinish: function () {
      announce(t("smx.done"));
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

  function stepNow(state, committed, armed) {
    if (state === "done") return steps.length;
    if (state === "playing" && armed >= 0) return armed + 1;
    return committed;
  }

  function render(state, committed, armed) {
    state = state || player.getState();
    committed = committed != null ? committed : player.getCommitted();
    armed = armed != null ? armed : player.getArmed();
    var step = stepNow(state, committed, armed);
    var st = stats(PRESETS[preset]);
    if (playBtn) {
      playBtn.textContent = t(state === "playing" ? "ui.pause" : state === "paused" ? "ui.resume" : "ui.play");
    }
    if (counter) {
      var n = state === "playing" && armed >= 0 ? armed + 1 : committed;
      counter.textContent = fill(t("ui.step"), { n: n, total: steps.length });
    }
    if (motionNote) motionNote.hidden = !reducedMotion();
    if (caption) {
      if (state === "done") caption.textContent = t("smx.done");
      else if (state === "playing" && step === 0) caption.textContent = t("ui.starting");
      else caption.textContent = captionFor(step, st);
    }
    if (valuesLine) {
      var presetKey = preset === "sharp" ? "smx.preset.sharp" : preset === "hot" ? "smx.preset.hot" : "smx.preset.mild";
      valuesLine.textContent = fill(t("smx.values"), {
        name: t(presetKey),
        xs: PRESETS[preset].map(fmtNum).join(", ")
      });
    }
    root.querySelectorAll("[data-smx-preset]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-smx-preset") === preset ? "true" : "false");
    });
  }

  root.querySelectorAll("[data-smx-preset]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = button.getAttribute("data-smx-preset");
      if (next === preset) return;
      preset = next;
      player.reset();
      announce(t("ui.annReset"));
    });
  });

  window.simdControls({ root: root, player: player });
  render();

  document.addEventListener("site-lang", function () {
    draw(stepNow(player.getState(), player.getCommitted(), player.getArmed()));
    render();
  });
})();
