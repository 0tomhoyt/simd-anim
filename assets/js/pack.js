/* Pack an 8×8 row-major panel into four contiguous 4×4 tiles.
   A 4-wide chunk is adjacent inside its row. The next row of that tile
   skips four source addresses and zero packed addresses. */
(function () {
  "use strict";

  var root = document.querySelector("[data-pk]");
  if (!root) return;

  var srcHost = root.querySelector("[data-pk-src]");
  var dstHost = root.querySelector("[data-pk-dst]");
  var playBtn = root.querySelector("[data-action='play']");
  var caption = root.querySelector("[data-caption]");
  var skipLine = root.querySelector("[data-skip]");
  var announcer = root.querySelector("[data-announcer]");
  var counter = root.querySelector("[data-counter]");
  var motionNote = root.querySelector("[data-motion-note]");
  var valuesLine = document.querySelector("[data-values]");
  var srcCells = [];
  var packCells = [];
  var strips = [];
  var wraps = [];
  var lastState = "idle";
  var moved = 0;

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

  function elementAtPacked(addr) {
    var tileIndex = Math.floor(addr / 16);
    var within = addr % 16;
    var ty = Math.floor(tileIndex / 2);
    var tx = tileIndex % 2;
    var row = ty * 4 + Math.floor(within / 4);
    var col = tx * 4 + (within % 4);
    return row * 8 + col;
  }

  function packedAddrOf(id) {
    var row = Math.floor(id / 8);
    var col = id % 8;
    var ty = Math.floor(row / 4);
    var tx = Math.floor(col / 4);
    return (ty * 2 + tx) * 16 + (row % 4) * 4 + (col % 4);
  }

  function rangeText(lo, hi) {
    return lo === hi ? String(lo) : lo + "–" + hi;
  }

  function span(cls, text) {
    var el = document.createElement("span");
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function build() {
    var ty;
    var tx;
    var r;
    var c;
    var s;
    var k;
    for (ty = 0; ty < 2; ty++) {
      for (tx = 0; tx < 2; tx++) {
        var wrap = document.createElement("div");
        wrap.className = "pk-block-wrap";
        wrap.setAttribute("data-pk-wrap", String(ty * 2 + tx));
        var lab = document.createElement("p");
        lab.className = "pk-block-label";
        lab.setAttribute("data-pk-block", String(ty * 2 + tx));
        var block = document.createElement("div");
        block.className = "pk-block";
        for (r = 0; r < 4; r++) {
          for (c = 0; c < 4; c++) {
            var id = (ty * 4 + r) * 8 + (tx * 4 + c);
            var cell = span("pk-cell", String(id));
            cell.setAttribute("data-pk-src", String(id));
            block.appendChild(cell);
            srcCells[id] = cell;
          }
        }
        wrap.appendChild(lab);
        wrap.appendChild(block);
        srcHost.appendChild(wrap);
        wraps.push(wrap);
      }
    }
    for (s = 0; s < 4; s++) {
      var strip = document.createElement("div");
      strip.className = "pk-strip";
      strip.setAttribute("data-pk-strip", String(s));
      var stripLab = document.createElement("p");
      stripLab.className = "pk-strip-label";
      strip.appendChild(stripLab);
      var cells = document.createElement("div");
      cells.className = "pk-cells";
      for (k = 0; k < 16; k++) {
        var addr = s * 16 + k;
        var packed = span("pk-cell", String(elementAtPacked(addr)));
        packed.setAttribute("data-pk-pack", String(addr));
        cells.appendChild(packed);
        packCells[addr] = packed;
      }
      strip.appendChild(cells);
      dstHost.appendChild(strip);
      strips.push({ strip: strip, label: stripLab });
    }
  }

  function labelStrips() {
    wraps.forEach(function (wrap) {
      var lab = wrap.querySelector("[data-pk-block]");
      lab.textContent = fill(t("pk.block"), { i: lab.getAttribute("data-pk-block") });
    });
    strips.forEach(function (entry, i) {
      entry.label.textContent = fill(t("pk.strip"), { i: i, a: i * 16, b: i * 16 + 15 });
    });
  }

  function draw(count) {
    var n = count * 4;
    var curLo = n - 4;
    var addr;
    labelStrips();
    for (addr = 0; addr < 64; addr++) {
      packCells[addr].classList.toggle("is-cur", n > 0 && addr >= curLo && addr < n);
      packCells[addr].classList.toggle("is-on", addr < curLo);
    }
    srcCells.forEach(function (cell, id) {
      var packed = packedAddrOf(id);
      cell.classList.toggle("is-cur", n > 0 && packed >= curLo && packed < n);
      cell.classList.toggle("is-on", packed < curLo);
    });
    strips.forEach(function (entry, i) {
      entry.strip.classList.toggle("is-on", n > 0 && i === Math.floor((n - 1) / 16));
      entry.strip.classList.toggle("is-done", n > 0 && i < Math.floor(n / 16));
    });
    wraps.forEach(function (wrap) {
      var i = Number(wrap.getAttribute("data-pk-wrap"));
      wrap.classList.toggle("is-on", n > 0 && i === Math.floor((n - 1) / 16));
    });
    moved = count;
    if (skipLine) {
      var chunk = count === 0 ? -1 : (count - 1) % 4;
      if (chunk > 0) {
        skipLine.hidden = false;
        skipLine.textContent = fill(t("pk.skip"), { n: 4 });
      } else {
        skipLine.hidden = true;
        skipLine.textContent = "";
      }
    }
  }

  function captionFor(count) {
    if (count <= 0) return t("pk.idle");
    var n = count * 4;
    var curLo = n - 4;
    var srcLo = elementAtPacked(curLo);
    var srcHi = elementAtPacked(n - 1);
    return fill(t("pk.line"), {
      t: Math.floor((n - 1) / 16) + 1,
      s: rangeText(Math.min(srcLo, srcHi), Math.max(srcLo, srcHi)),
      p: rangeText(curLo, n - 1)
    });
  }

  var steps = [];
  var i;
  for (i = 0; i < 16; i++) steps.push({ n: i + 1 });

  build();

  var player = window.simdPlayer({
    steps: steps,
    armMs: 280,
    gapMs: 180,
    onArm: function (_step, index) {
      draw(index + 1);
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
      announce(t("pk.done"));
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

  function countNow(state, committed, armed) {
    if (state === "done") return steps.length;
    if (state === "playing" && armed >= 0) return armed + 1;
    return committed;
  }

  function render(state, committed, armed) {
    state = state || player.getState();
    committed = committed != null ? committed : player.getCommitted();
    armed = armed != null ? armed : player.getArmed();
    var count = countNow(state, committed, armed);
    if (playBtn) {
      playBtn.textContent = t(state === "playing" ? "ui.pause" : state === "paused" ? "ui.resume" : "ui.play");
    }
    if (counter) {
      var n = state === "playing" && armed >= 0 ? armed + 1 : committed;
      counter.textContent = fill(t("ui.step"), { n: n, total: steps.length });
    }
    if (motionNote) motionNote.hidden = !reducedMotion();
    if (caption) {
      if (state === "done") caption.textContent = t("pk.done");
      else if (state === "playing" && count === 0) caption.textContent = t("ui.starting");
      else caption.textContent = captionFor(count);
    }
    if (valuesLine) valuesLine.textContent = t("pk.values");
  }

  window.simdControls({ root: root, player: player });
  render();

  document.addEventListener("site-lang", function () {
    draw(countNow(player.getState(), player.getCommitted(), player.getArmed()));
    render();
  });
})();
