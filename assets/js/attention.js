/* One head of attention, small enough to read: four tokens, d = 4.
   Steps are QKᵀ (one key at a time), softmax weights, weighted V, mixed output.
   Changing the query token rebuilds the same seven steps. */
(function () {
  "use strict";

  var root = document.querySelector("[data-attn]");
  if (!root) return;

  var Q = [
    [1, 0, 0, 0],
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 1]
  ];
  var K = [
    [1, 0, 0, 1],
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 1]
  ];
  var V = [
    [3, 0, 1, 0],
    [1, 3, 0, 1],
    [0, 1, 3, 1],
    [1, 0, 1, 3]
  ];
  var N = 4;
  var q = 2;

  var qHost = root.querySelector("[data-att-q]");
  var kHost = root.querySelector("[data-att-k]");
  var sHost = root.querySelector("[data-att-scores]");
  var vHost = root.querySelector("[data-att-v]");
  var oHost = root.querySelector("[data-att-o]");
  var playBtn = root.querySelector("[data-action='play']");
  var caption = root.querySelector("[data-caption]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var qCells = [];
  var kRows = [];
  var scoreEls = [];
  var weightEls = [];
  var fills = [];
  var vRows = [];
  var oCells = [];
  var lastState = "idle";

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

  function dot(a, b) {
    var s = 0;
    var i;
    for (i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function dotTerms(a, b) {
    var parts = [];
    var s = 0;
    var i;
    for (i = 0; i < a.length; i++) {
      parts.push(String(a[i]) + "·" + String(b[i]));
      s += a[i] * b[i];
    }
    return parts.join(" + ") + " = " + s;
  }

  function scoresOf(qi) {
    var s = [];
    var i;
    for (i = 0; i < N; i++) s.push(dot(Q[qi], K[i]));
    return s;
  }

  function softmax(xs) {
    var m = xs[0];
    var i;
    for (i = 1; i < xs.length; i++) if (xs[i] > m) m = xs[i];
    var exps = [];
    var sum = 0;
    for (i = 0; i < xs.length; i++) {
      var e = Math.exp(xs[i] - m);
      exps.push(e);
      sum += e;
    }
    var w = [];
    for (i = 0; i < exps.length; i++) w.push(exps[i] / sum);
    return w;
  }

  function mix(w) {
    var out = [0, 0, 0, 0];
    var i;
    var d;
    for (i = 0; i < N; i++) {
      for (d = 0; d < N; d++) out[d] += w[i] * V[i][d];
    }
    return out;
  }

  function span(cls, text) {
    var el = document.createElement("span");
    el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function build() {
    var d;
    var i;
    var c;
    for (d = 0; d < N; d++) {
      var qRow = document.createElement("div");
      qRow.className = "att-row";
      qRow.appendChild(span("att-idx", "d" + d));
      var qCell = span("att-cell", "0");
      qRow.appendChild(qCell);
      qHost.appendChild(qRow);
      qCells.push(qCell);
    }
    for (i = 0; i < N; i++) {
      var kRow = document.createElement("div");
      kRow.className = "att-row";
      kRow.appendChild(span("att-idx", "k" + i));
      var cells = [];
      for (c = 0; c < N; c++) {
        var kCell = span("att-cell", "0");
        kRow.appendChild(kCell);
        cells.push(kCell);
      }
      kHost.appendChild(kRow);
      kRows.push({ row: kRow, cells: cells });
    }
    for (i = 0; i < N; i++) {
      var sRow = document.createElement("div");
      sRow.className = "att-row";
      sRow.appendChild(span("att-idx", "k" + i));
      var sEl = span("att-num", "·");
      var wEl = span("att-num", "·");
      var track = span("att-track");
      var bar = span("att-fill");
      track.appendChild(bar);
      sRow.appendChild(sEl);
      sRow.appendChild(wEl);
      sRow.appendChild(track);
      sHost.appendChild(sRow);
      scoreEls.push(sEl);
      weightEls.push(wEl);
      fills.push(bar);
    }
    for (i = 0; i < N; i++) {
      var vRow = document.createElement("div");
      vRow.className = "att-row";
      vRow.appendChild(span("att-idx", "v" + i));
      var vs = [];
      for (c = 0; c < N; c++) {
        var vCell = span("att-cell", "0");
        vRow.appendChild(vCell);
        vs.push(vCell);
      }
      var wt = span("att-vwt", "");
      vRow.appendChild(wt);
      vHost.appendChild(vRow);
      vRows.push({ row: vRow, cells: vs, wt: wt });
    }
    for (d = 0; d < N; d++) {
      var oRow = document.createElement("div");
      oRow.className = "att-row";
      oRow.appendChild(span("att-idx", "d" + d));
      var oCell = span("att-cell att-wide", "·");
      oRow.appendChild(oCell);
      oHost.appendChild(oRow);
      oCells.push(oCell);
    }
  }

  function draw(beat) {
    var sc = scoresOf(q);
    var w = softmax(sc);
    var out = mix(w);
    var shown = Math.min(N, beat);
    var weightsOn = beat >= 5;
    var vOn = beat >= 6;
    var outOn = beat >= 7;
    var d;
    var i;
    var c;
    for (d = 0; d < N; d++) {
      qCells[d].textContent = String(Q[q][d]);
      qCells[d].classList.toggle("is-cur", beat >= 1 && beat <= 4);
      qCells[d].classList.toggle("is-on", beat === 0 || beat > 4);
    }
    for (i = 0; i < N; i++) {
      for (c = 0; c < N; c++) kRows[i].cells[c].textContent = String(K[i][c]);
      kRows[i].row.classList.toggle("is-cur", beat >= 1 && beat <= 4 && i === beat - 1);
      kRows[i].row.classList.toggle("is-on", i < shown && !(beat >= 1 && beat <= 4 && i === beat - 1));
    }
    for (i = 0; i < N; i++) {
      var known = i < shown;
      scoreEls[i].textContent = known ? String(sc[i]) : "·";
      scoreEls[i].classList.toggle("is-on", known);
      scoreEls[i].classList.toggle("is-cur", beat >= 1 && beat <= 4 && i === beat - 1);
      weightEls[i].textContent = weightsOn ? fmtNum(w[i]) : "·";
      weightEls[i].classList.toggle("is-on", weightsOn);
      fills[i].style.width = weightsOn ? Math.max(4, Math.round(w[i] * 100)) + "%" : "0%";
    }
    var hottest = 0;
    for (i = 1; i < N; i++) if (w[i] > w[hottest]) hottest = i;
    for (i = 0; i < N; i++) {
      for (c = 0; c < N; c++) vRows[i].cells[c].textContent = String(V[i][c]);
      vRows[i].wt.textContent = vOn ? fmtNum(w[i]) : "";
      vRows[i].row.classList.toggle("is-on", vOn);
      vRows[i].row.classList.toggle("is-cur", vOn && i === hottest);
      if (vOn) {
        var mixPct = Math.round(18 + 72 * w[i]);
        vRows[i].row.style.background =
          "color-mix(in srgb, var(--accent-fill) " + mixPct + "%, transparent)";
      } else {
        vRows[i].row.style.background = "";
      }
    }
    for (d = 0; d < N; d++) {
      oCells[d].textContent = outOn ? fmtNum(out[d]) : "·";
      oCells[d].classList.toggle("is-on", outOn);
    }
    root.querySelectorAll("[data-att-stage]").forEach(function (panel) {
      var stage = panel.getAttribute("data-att-stage");
      var on = false;
      if (beat === 0) on = stage === "q" || stage === "k";
      else if (beat <= 4) on = stage === "q" || stage === "k" || stage === "s";
      else if (beat === 5) on = stage === "s";
      else if (beat === 6) on = stage === "v";
      else on = stage === "o";
      panel.classList.toggle("is-on", on);
    });
  }

  function captionFor(beat) {
    if (beat <= 0) return t("attn.idle");
    if (beat <= 4) {
      return fill(t("attn.scoreLine"), { i: beat - 1, v: dotTerms(Q[q], K[beat - 1]) });
    }
    if (beat === 5) return fill(t("attn.softLine"), { s: (1).toFixed(2) });
    if (beat === 6) return t("attn.mixLine");
    return t("attn.outLine");
  }

  var steps = [
    { beat: 1 },
    { beat: 2 },
    { beat: 3 },
    { beat: 4 },
    { beat: 5 },
    { beat: 6 },
    { beat: 7 }
  ];

  build();

  var player = window.simdPlayer({
    steps: steps,
    armMs: 420,
    gapMs: 260,
    onArm: function (_step, i) {
      draw(i + 1);
    },
    onCommit: function () {},
    onSeek: function (count) {
      draw(count);
    },
    onApplyAll: function () {
      draw(steps.length);
    },
    onReset: function () {
      draw(0);
    },
    onFinish: function () {
      announce(t("attn.done"));
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

  function beatNow(state, committed, armed) {
    if (state === "done") return steps.length;
    if (state === "playing" && armed >= 0) return armed + 1;
    return committed;
  }

  function renderCaption(state, committed, armed) {
    if (!caption) return;
    if (state === "done") {
      caption.textContent = t("attn.done");
      return;
    }
    var beat = beatNow(state, committed, armed);
    if (state === "playing" && beat === 0) caption.textContent = t("ui.starting");
    else caption.textContent = captionFor(beat);
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
    if (valuesLine) {
      valuesLine.textContent = fill(t("attn.values"), { q: q, vec: Q[q].join(", ") });
    }
    root.querySelectorAll("[data-attn-q]").forEach(function (button) {
      button.setAttribute("aria-pressed", Number(button.getAttribute("data-attn-q")) === q ? "true" : "false");
    });
  }

  root.querySelectorAll("[data-attn-q]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = Number(button.getAttribute("data-attn-q"));
      if (next === q) return;
      q = next;
      player.reset();
      announce(t("ui.annReset"));
    });
  });

  window.simdControls({ root: root, player: player });
  render();

  document.addEventListener("site-lang", function () {
    draw(beatNow(player.getState(), player.getCommitted(), player.getArmed()));
    render();
  });
})();
