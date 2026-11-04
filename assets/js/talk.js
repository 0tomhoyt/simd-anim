/* Talk mode shell. Strings the site's pages into one guided order for a
   live talk: each page stop loads as a same-origin iframe with the site
   chrome hidden, kept alive so going back restores its animation state.
   Keys: N/P or PageDown/PageUp move between stops, O opens the stop list,
   F fullscreen, B blackout, C collapses the cue bar. Arrow keys and space
   keep driving the animation inside the current page (the pages own those
   keys, and the injected bridge forwards the shell keys from inside too). */

(function () {
  "use strict";

  var DATE = "2026-11-05";

  /* One guided pass for a 15-20 minute mixed-background talk:
     the hardware names -> cycles/GFLOPS -> the register map -> the SVE
     ideas -> the SME outer product -> composition -> the two strategy
     pages that say what speed actually is. */
  var STOPS = [
    {
      kind: "card",
      id: "title",
      title: { en: "Opening", zh: "开场" },
      cue: {
        en: "Welcome. N advances the talk; arrow keys drive each page's animation.",
        zh: "开场。N 前进；方向键操作页面动画。",
      },
    },
    {
      kind: "page",
      href: "../strategy/sme-anatomy/",
      id: "anatomy",
      title: { en: "The hardware — Z, ZA, compute", zh: "硬件词汇 —— Z、ZA、计算单元" },
      cue: {
        en: "Three names before anything else: a Z register, the ZA tile, the compute unit — every later page uses them.",
        zh: "先立三个名字：Z 寄存器、ZA tile、计算单元 —— 后面每一页都在用它们。",
      },
    },
    {
      kind: "card",
      id: "units",
      title: { en: "Cycles and GFLOPS", zh: "两把标尺 —— Cycle 与 GFLOPS" },
      cue: {
        en: "The two units every later number is measured with: the cycle for time (L1 a few ticks, HBM hundreds), GFLOPS for speed (cores x frequency x FLOPs per cycle). → walks them.",
        zh: "后面所有数字用的两把尺子：量时间的 cycle（L1 几拍、HBM 几百拍），量速度的 GFLOPS（核数 × 频率 × 每拍 FLOP）。按 → 逐把讲。",
      },
    },
    {
      kind: "card",
      id: "registers",
      title: { en: "Registers — four families", zh: "寄存器 —— 四个家族" },
      cue: {
        en: "All four families on one map: x general, p predicate, z vector, ZA matrix. → walks them; the last step is the route for the next stops.",
        zh: "四个家族一张图：x 通用、p 谓词、z 向量、ZA 矩阵。按 → 逐个细讲；最后一步是接下来几站的路线。",
      },
    },
    {
      kind: "page",
      href: "../instructions/whilelt/",
      id: "whilelt",
      title: { en: "WHILELT — where predicates come from", zh: "WHILELT —— 谓词从哪来" },
      cue: {
        en: "One comparison per lane: lane i asks is x0+i < x1? With x0=2, x1=5 the left column reads 2,3,4,5 — lanes 0-2 write 1, lane 3 writes 0. Then bump x0 live and watch the pattern slide.",
        zh: "每路只做一次比较：第 i 路问 x0+i < x1 吗？x0=2、x1=5 时左列是 2,3,4,5 —— 前三路写 1，第 3 路写 0。再现场加 x0，看位图整体平移。",
      },
    },
    {
      kind: "page",
      href: "../instructions/ld1w/",
      id: "ld1w",
      title: { en: "LD1W — a predicated load", zh: "LD1W —— 带谓词的加载" },
      cue: {
        en: "Active lanes read memory, /z zeroes the rest. Click a predicate bit mid-animation.",
        zh: "激活通道读内存，/z 把其余清零。动画进行中点掉一个谓词位看效果。",
      },
    },
    {
      kind: "page",
      href: "../instructions/fmla/",
      id: "fmla",
      title: { en: "FMLA — the familiar SIMD shape", zh: "FMLA —— 最熟悉的 SIMD 形态" },
      cue: {
        en: "Start with the shape everyone knows: one FMA per lane, vectors in, vectors out — p/m simply decides who participates.",
        zh: "先讲人人都熟的形态：逐通道乘加，向量进、向量出 —— p/m 只决定谁参与。",
      },
    },
    {
      kind: "page",
      href: "../instructions/fmopa/",
      id: "fmopa",
      title: { en: "FMOPA — the outer product", zh: "FMOPA —— 外积" },
      cue: {
        en: "Now break that shape: fmopa is an outer product, z0 down the rows and z1 across, filling the whole ZA tile — 16 FMAs in one instruction. Step it, then flip to Parallel.",
        zh: "再打破这个形态：fmopa 是外积，z0 竖着铺行、z1 横着铺列，一次填满整个 ZA tile —— 一条指令 16 个乘加。先逐步播放，再切 Parallel。",
      },
    },
    {
      kind: "page",
      href: "../instructions/st1w/",
      id: "st1w",
      title: { en: "ZA — load, store, transpose", zh: "ZA —— 读取、存储、转置" },
      cue: {
        en: "Read: ld1w fills za0h slices. Store: st1w, w12 picks the row (this page). Transpose: za0h in, za0v out — costs one extra ZA tile.",
        zh: "读：ld1w 写 za0h 切片；存：st1w 按 w12 选行（本页动画）；转置：横进竖出 za0h→za0v，代价占一个额外 tile。",
      },
    },
    {
      kind: "page",
      href: "../kernels/microkernel/",
      id: "microkernel",
      title: { en: "Microkernel — compose everything", zh: "Microkernel —— 全部拼起来" },
      cue: {
        en: "pack -> ldr + fmopa loop -> store. Toggle the layout selectors: it survives every transpose state.",
        zh: "pack → ldr+fmopa 循环 → 存储。切换布局选择器：四种转置状态都成立。",
      },
    },
    {
      kind: "page",
      href: "../strategy/roofline/",
      id: "roofline",
      title: { en: "Roofline — what limits you", zh: "Roofline —— 谁限制了你" },
      cue: {
        en: "Drag the sliders: past the ridge, more bandwidth buys nothing — arithmetic intensity is the currency.",
        zh: "拖动滑块：过了脊点，再加带宽也没用 —— 计算强度才是硬通货。",
      },
    },
    {
      kind: "card",
      id: "kitchen",
      title: { en: "Memory flow, in a kitchen", zh: "厨房里的访存流水" },
      cue: {
        en: "The memory-flow story told in a kitchen first: stove Core, board L1, fridge L2, supermarket HBM, one elevator. → walks the three moves; the last step is the collision.",
        zh: "先用厨房讲访存：灶台 Core、案板 L1、冰箱 L2、超市 HBM、一部电梯。按 → 逐招讲；最后一步是撞车的那一拍。",
      },
    },
    {
      kind: "page",
      href: "../strategy/memory-flow/",
      id: "mflow",
      title: { en: "Memory in flight", zh: "内存时序" },
      cue: {
        en: "The same play on real hardware: play the timeline and watch just two things — B's load landing in L2 (hit-tagged), and the one HBM slot where read and write share the car (128/64).",
        zh: "厨房的真机版：播放时间线，只盯两处 —— B 的 load 落在 L2（带命中标签）；HBM 行读+写挤同一拍（128/64）。",
      },
    },
    {
      kind: "page",
      href: "../kernels/attention/",
      id: "attn",
      title: { en: "Attention — the whole pipeline", zh: "Attention —— 整条流水线" },
      cue: {
        en: "One play, two GEMMs: QKᵀ gives scores, softmax weights them, the mix with V writes the output. Leave the question hanging: where do the scores sit between the two?",
        zh: "一次播放两个 GEMM：QKᵀ 出分数，softmax 变权重，与 V 混合写输出。留个问题挂着：两个 GEMM 之间，分数停在哪？",
      },
    },
    {
      kind: "card",
      id: "fuse",
      title: { en: "Fusing softmax into GEMM", zh: "Softmax×GEMM 融合" },
      cue: {
        en: "The answer the fast kernels give: the scores never leave ZA — softmax happens on the tile, and GEMM two eats the slices directly. → three moves, then the ledger.",
        zh: "快 kernel 的答案：分数不出 ZA —— softmax 在 tile 上原地做，第二个 GEMM 直接吃切片。按 → 三招，最后是账本。",
      },
    },
    {
      kind: "card",
      id: "end",
      title: { en: "Q&A", zh: "提问" },
      cue: {
        en: "Leave this open for questions — O jumps back to any stop.",
        zh: "停在提问环节 —— 按 O 随时跳回任意一页。",
      },
    },
  ];

  /* Hidden inside every page stop: the site header/footer, the back link,
     the course-path chrome (chapter counters, prev/next), the types note,
     and the memory-flow strategy prose (the cue bar narrates all of these).
     The wider .page and the whilelt lane labels buy landscape projection
     room. Scaling to fit is applied by fitFrame() below. */
  var FRAME_CSS =
    ".skip-link,.site-header,.site-footer,.back,.spec-note{display:none !important;}" +
    ".path-bar,.path-steps,.path-hint,.path-end,.kbd-note,.mflow-plan,.notes{display:none !important;}" +
    ".page{width:100%;padding:0 3rem;}" +
    /* Slide layout: title/instruction left, the animated stage right,
       both vertically centered — pages read like slides, not articles.
       The two 1fr rows plus fixed height lock the grid to the viewport,
       so the stage column always centers exactly. */
    ".demo-main{display:grid;grid-template-columns:minmax(20rem,2fr) 3fr;grid-template-rows:1fr 1fr;column-gap:3rem;align-items:center;height:100vh;padding:0;}" +
    ".demo-head{grid-column:1;grid-row:1;align-self:end;padding:0 0 0.9rem;}" +
    ".insn{grid-column:1;grid-row:2;align-self:start;width:fit-content;max-width:100%;margin:0;padding:0.75rem 1rem 0.85rem;}" +
    ".bench{grid-column:2;grid-row:1/span 2;width:fit-content;max-width:100%;margin:0 auto;}" +
    ".demo-head h1{font-size:clamp(2rem,3.4vw,3rem);}" +
    ".demo-head .lede{font-size:1.02rem;}" +
    /* Wide-stage pages keep one centered column. */
    ".talk-stop-roofline .demo-main,.talk-stop-mflow .demo-main,.talk-stop-attn .demo-main{display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
    ".talk-stop-roofline .bench,.talk-stop-mflow .bench,.talk-stop-attn .bench{grid-column:auto;grid-row:auto;}" +
    ".talk-stop-roofline .insn,.talk-stop-mflow .insn,.talk-stop-attn .insn{align-self:center;}" +
    ".talk-stop-roofline .demo-head,.talk-stop-mflow .demo-head,.talk-stop-attn .demo-head{text-align:center;}" +
    "[data-whilelt] .col-stack{counter-reset:lane-i;}" +
    "[data-whilelt] .lane[data-vec='x']{counter-increment:lane-i;}" +
    "[data-whilelt] .lane[data-vec='x']::before{content:'i=' counter(lane-i);margin-right:0.35rem;font-family:var(--mono,monospace);font-size:0.6rem;color:#5c5952;}" +
    "[data-whilelt] .op-glyph{font-size:1.05rem;font-weight:650;color:#b23e24;}" +
    "[data-whilelt] .lane.is-live{outline:2px solid #b23e24;outline-offset:2px;}" +
    /* Memory flow, talk-cut: the lede and the op listing leave, the timeline
       stays — the cue bar carries the three moves directly. */
    ".talk-stop-mflow .lede,.talk-stop-mflow .insn{display:none !important;}";

  /* Projectors are one screen, no scrolling: scale each page so its
     content fills the viewport without spilling. Two-column slides
     budget the taller of (title column, stage); the wide-stage pages
     stack title over stage, so they budget the sum. Measured at zoom 1,
     clamped so text never gets absurdly small or huge, then verified
     with one correction pass after the zoom lands. */
  function fitFrame(iframe) {
    var doc = null;
    try {
      doc = iframe.contentDocument;
    } catch (error) {
      doc = null;
    }
    if (!doc || !doc.body) return;
    var bench = doc.querySelector(".bench");
    var head = doc.querySelector(".demo-head");
    var insn = doc.querySelector(".insn");
    var vh = doc.documentElement.clientHeight || 0;
    if (!bench || vh < 400) return;
    var flexPage =
      doc.body.classList.contains("talk-stop-roofline") ||
      doc.body.classList.contains("talk-stop-mflow") ||
      doc.body.classList.contains("talk-stop-attn");
    doc.body.style.zoom = "";
    var benchH = bench.getBoundingClientRect().height;
    var headH = head ? head.getBoundingClientRect().height : 0;
    var insnH = insn && getComputedStyle(insn).display !== "none"
      ? insn.getBoundingClientRect().height
      : 0;
    var contentH = flexPage ? headH + insnH + benchH : Math.max(headH + insnH, benchH);
    if (contentH < 80) return;
    var main = doc.querySelector(".demo-main");
    var byHeight = (vh * 0.9) / contentH;
    var byWidth = (doc.documentElement.clientWidth * 0.96) / Math.max(1, bench.getBoundingClientRect().width);
    var target = Math.max(0.72, Math.min(1.3, byHeight, byWidth));
    doc.body.style.zoom = String(target);
    /* zoom scales vh-sized containers too (100vh renders as vh*zoom), so
       pin the main column to the real viewport height at the new zoom. */
    if (main) main.style.height = (vh / target) + "px";
    /* One correction pass: layout may have settled differently under zoom. */
    window.requestAnimationFrame(function () {
      var box = bench.getBoundingClientRect();
      var spill = box.height + 24 - vh;
      if (spill > 0 && target > 0.72) {
        var next = Math.max(0.72, target * (vh / (vh + spill)));
        doc.body.style.zoom = String(next);
        if (main) main.style.height = (vh / next) + "px";
      }
    });
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      Object.keys(frames).forEach(function (key) {
        fitFrame(frames[key]);
      });
    }, 150);
  });

  /* Forwarded keys from inside an iframe (focus follows clicks there, so
     the parent listener alone would go deaf mid-talk). */
  var BRIDGE =
    "(function(){function send(k){try{if(window.parent&&window.parent.__talkKey)window.parent.__talkKey(k)}catch(e){}}" +
    "document.addEventListener('keydown',function(e){if(e.metaKey||e.ctrlKey||e.altKey)return;" +
    "var k=e.key,m=null;" +
    "if(k==='n'||k==='N'||k==='PageDown')m='next';" +
    "else if(k==='p'||k==='P'||k==='PageUp')m='prev';" +
    "else if(k==='f'||k==='F')m='full';" +
    "else if(k==='b'||k==='B')m='black';" +
    "else if(k==='o'||k==='O')m='over';" +
    "else if(k==='c'||k==='C')m='cue';" +
    "else if(k==='Escape')m='esc';" +
    "if(!m)return;e.preventDefault();e.stopPropagation();send(m)},true)})();";

  var root = document.querySelector("[data-talk]");
  var stage = document.querySelector("[data-stage]");
  var titleCard = document.querySelector('[data-card="title"]');
  var endCard = document.querySelector('[data-card="end"]');
  var registersCard = document.querySelector('[data-card="registers"]');
  var unitsCard = document.querySelector('[data-card="units"]');
  var kitchenCard = document.querySelector('[data-card="kitchen"]');
  var fuseCard = document.querySelector('[data-card="fuse"]');
  var cueTitle = document.querySelector("[data-stop-title]");
  var cueText = document.querySelector("[data-cue-text]");
  var counterBtn = document.querySelector("[data-counter]");
  var overviewEl = document.querySelector("[data-overview]");
  var overviewList = document.querySelector("[data-overview-list]");
  var blackoutEl = document.querySelector("[data-blackout-layer]");

  var frames = {}; /* stop index -> iframe, kept alive once created */
  var current = -1;

  /* Card reveals (register map, units): step 0 shows the whole card,
     then one block each, then the closing strip. Arrow keys and clicks
     drive the reveal; N/P still move stops, so the card and the talk
     clock stay out of each other's way. */
  var REVEALS = {
    registers: [
      "talk.regStep0",
      "talk.regStep1",
      "talk.regStep2",
      "talk.regStep3",
      "talk.regStep4",
      "talk.regStep5",
    ],
    units: [
      "talk.unitsStep0",
      "talk.unitsStep1",
      "talk.unitsStep2",
      "talk.unitsStep3",
    ],
    kitchen: [
      "talk.kitchenStep0",
      "talk.kitchenStep1",
      "talk.kitchenStep2",
      "talk.kitchenStep3",
      "talk.kitchenStep4",
    ],
    fuse: [
      "talk.fuseStep0",
      "talk.fuseStep1",
      "talk.fuseStep2",
      "talk.fuseStep3",
      "talk.fuseStep4",
    ],
  };

  function revealCard(id) {
    return document.querySelector('[data-card="' + id + '"]');
  }

  function activeRevealId() {
    if (current < 0) return null;
    var stop = STOPS[current];
    return stop.kind === "card" && REVEALS[stop.id] ? stop.id : null;
  }

  function setRevealStep(id, n) {
    var keys = REVEALS[id];
    var card = revealCard(id);
    if (!keys || !card) return;
    n = Math.max(0, Math.min(keys.length - 1, n));
    card.setAttribute("data-step", String(n));
    var caption = card.querySelector("[data-reg-caption]");
    if (caption) caption.textContent = t(keys[n]);
  }

  function revealStepOf(id) {
    var card = revealCard(id);
    return card ? Number(card.getAttribute("data-step")) || 0 : 0;
  }

  function lang() {
    return window.siteI18n && window.siteI18n.lang() === "zh" ? "zh" : "en";
  }

  function t(key) {
    return window.siteI18n ? window.siteI18n.t(key) : key;
  }

  function stopText(stop, field) {
    var value = stop[field] && stop[field][lang()];
    return value || (stop[field] && stop[field].en) || "";
  }

  /* Same-origin pages only; on file:// (or a cross-origin host) dressing
     silently no-ops and the stop still loads, just with site chrome. */
  function dressFrame(iframe) {
    var doc = null;
    try {
      doc = iframe.contentDocument;
    } catch (error) {
      doc = null;
    }
    if (!doc || !doc.head || !doc.body) return;

    /* Per-stop class so FRAME_CSS can target one stop's page. */
    var stopId = iframe.getAttribute("data-talk-stop");
    if (stopId) doc.body.classList.add("talk-stop-" + stopId);

    var style = doc.createElement("style");
    style.textContent = FRAME_CSS;
    doc.head.appendChild(style);

    /* Fit after the next paint so the page's own layout has settled. */
    var fit = function () {
      fitFrame(iframe);
    };
    if (doc.defaultView && doc.defaultView.requestAnimationFrame) {
      doc.defaultView.requestAnimationFrame(function () {
        doc.defaultView.setTimeout(fit, 50);
      });
    } else {
      setTimeout(fit, 80);
    }

    var bridge = doc.createElement("script");
    bridge.textContent = BRIDGE;
    doc.body.appendChild(bridge);
  }

  function ensureFrame(i) {
    if (i < 0 || i >= STOPS.length) return null;
    var stop = STOPS[i];
    if (stop.kind !== "page") return null;
    if (!frames[i]) {
      var iframe = document.createElement("iframe");
      iframe.className = "talk-frame";
      iframe.title = stopText(stop, "title");
      if (stop.id) iframe.setAttribute("data-talk-stop", stop.id);
      iframe.addEventListener("load", function () {
        dressFrame(iframe);
      });
      iframe.src = stop.href;
      stage.appendChild(iframe);
      frames[i] = iframe;
    }
    return frames[i];
  }

  function updateBar() {
    var stop = STOPS[current];
    cueTitle.textContent = stopText(stop, "title");
    cueText.textContent = stopText(stop, "cue");
    counterBtn.textContent = t("talk.counter")
      .replace("{n}", String(current + 1))
      .replace("{m}", String(STOPS.length));
    var prevBtn = document.querySelector('[data-go="prev"]');
    var nextBtn = document.querySelector('[data-go="next"]');
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= STOPS.length - 1;
  }

  function buildOverview() {
    overviewList.innerHTML = "";
    STOPS.forEach(function (stop, i) {
      var li = document.createElement("li");
      if (i === current) li.className = "is-current";
      var button = document.createElement("button");
      button.type = "button";
      var num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1).padStart(2, "0");
      var name = document.createElement("span");
      name.textContent = stopText(stop, "title");
      button.appendChild(num);
      button.appendChild(name);
      button.addEventListener("click", function () {
        closeOverview();
        show(i);
      });
      li.appendChild(button);
      overviewList.appendChild(li);
    });
  }

  function show(i) {
    current = Math.max(0, Math.min(STOPS.length - 1, i));
    var stop = STOPS[current];

    titleCard.hidden = !(stop.kind === "card" && stop.id === "title");
    endCard.hidden = !(stop.kind === "card" && stop.id === "end");
    registersCard.hidden = !(stop.kind === "card" && stop.id === "registers");
    unitsCard.hidden = !(stop.kind === "card" && stop.id === "units");
    kitchenCard.hidden = !(stop.kind === "card" && stop.id === "kitchen");
    fuseCard.hidden = !(stop.kind === "card" && stop.id === "fuse");
    var enteringReveal = activeRevealId();
    if (enteringReveal) setRevealStep(enteringReveal, 0);

    var active = ensureFrame(current);
    Object.keys(frames).forEach(function (key) {
      frames[key].classList.toggle("is-active", frames[key] === active);
    });

    /* Refit the stop becoming visible: pages can settle after their load
       fit (fonts, late relabels, control rows wrapping), and a page fitted
       while preloading hidden measures a slightly different box. */
    if (active) {
      window.requestAnimationFrame(function () {
        window.setTimeout(function () {
          fitFrame(active);
        }, 120);
      });
    }

    /* Warm the next stop so the talk never shows a loading flash. */
    ensureFrame(current + 1);

    updateBar();
    buildOverview();
    try {
      history.replaceState(null, "", "#" + (current + 1));
    } catch (error) {
      /* file:// and the like can refuse; the talk goes on. */
    }
  }

  function next() {
    if (current < STOPS.length - 1) show(current + 1);
  }

  function previous() {
    if (current > 0) show(current - 1);
  }

  function openOverview() {
    buildOverview();
    overviewEl.hidden = false;
  }

  function closeOverview() {
    overviewEl.hidden = true;
  }

  function toggleOverview() {
    if (overviewEl.hidden) openOverview();
    else closeOverview();
  }

  function toggleBlackout() {
    blackoutEl.hidden = !blackoutEl.hidden;
  }

  function toggleCueBar() {
    root.classList.toggle("talk-cuebar-off");
  }

  function toggleFullscreen() {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch (error) {
      /* Fullscreen can be blocked by the embedding context; ignore. */
    }
  }

  /* One entry point for keys, whether they land on the shell or arrive
     through the iframe bridge. */
  window.__talkKey = function (m) {
    if (m === "next") next();
    else if (m === "prev") previous();
    else if (m === "over") toggleOverview();
    else if (m === "full") toggleFullscreen();
    else if (m === "black") toggleBlackout();
    else if (m === "cue") toggleCueBar();
    else if (m === "esc") {
      if (!overviewEl.hidden) closeOverview();
      else if (!blackoutEl.hidden) toggleBlackout();
    }
  };

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var key = event.key;
    /* On reveal cards (register map, units) the arrows and space walk the
       reveal; every other stop hands those keys to the page animation. The
       overview must be closed first, so arrows never fight its list. */
    var revealId = activeRevealId();
    if (revealId && overviewEl.hidden && (key === "ArrowRight" || key === " ")) {
      event.preventDefault();
      setRevealStep(revealId, revealStepOf(revealId) + 1);
      return;
    }
    if (revealId && overviewEl.hidden && key === "ArrowLeft") {
      event.preventDefault();
      setRevealStep(revealId, revealStepOf(revealId) - 1);
      return;
    }
    var m = null;
    if (key === "n" || key === "N" || key === "PageDown") m = "next";
    else if (key === "p" || key === "P" || key === "PageUp") m = "prev";
    else if (key === "f" || key === "F") m = "full";
    else if (key === "b" || key === "B") m = "black";
    else if (key === "o" || key === "O") m = "over";
    else if (key === "c" || key === "C") m = "cue";
    else if (key === "Escape") m = "esc";
    if (!m) return;
    event.preventDefault();
    window.__talkKey(m);
  });

  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.getAttribute("data-go") === "next") next();
      else previous();
    });
  });

  document.querySelectorAll("[data-overview-open]").forEach(function (button) {
    button.addEventListener("click", openOverview);
  });

  document.querySelectorAll("[data-overview-close]").forEach(function (button) {
    button.addEventListener("click", closeOverview);
  });

  document.querySelector("[data-fullscreen]").addEventListener("click", toggleFullscreen);
  document.querySelector("[data-blackout]").addEventListener("click", toggleBlackout);
  blackoutEl.addEventListener("click", toggleBlackout);
  overviewEl.addEventListener("click", function (event) {
    if (event.target === overviewEl) closeOverview();
  });

  /* Clicking a block on a reveal card jumps the reveal to that block. */
  var FAM_ORDER = {
    registers: ["x", "p", "z", "za"],
    units: ["cycle", "gflops"],
    kitchen: ["prefetch", "ntstore", "drain"],
    fuse: ["stay", "softmax", "feed"],
  };
  Object.keys(FAM_ORDER).forEach(function (id) {
    var card = revealCard(id);
    if (!card) return;
    card.querySelectorAll(".reg-fam").forEach(function (fam) {
      fam.addEventListener("click", function () {
        var idx = FAM_ORDER[id].indexOf(fam.getAttribute("data-fam"));
        if (idx >= 0) setRevealStep(id, idx + 1);
      });
    });
  });

  /* i18n dispatches this after every language change: the data-i18n spans
     re-rendered themselves, the shell data and live frames follow here. */
  document.addEventListener("site-lang", function () {
    titleCard.querySelector("[data-card-date]").textContent = DATE;
    var langReveal = activeRevealId();
    if (langReveal) setRevealStep(langReveal, revealStepOf(langReveal));
    Object.keys(frames).forEach(function (key) {
      var iframe = frames[key];
      iframe.title = stopText(STOPS[Number(key)], "title");
      try {
        if (iframe.contentWindow) iframe.contentWindow.location.reload();
      } catch (error) {
        /* Unreachable frames just keep their language. */
      }
    });
    updateBar();
    buildOverview();
  });

  titleCard.querySelector("[data-card-date]").textContent = DATE;

  var initial = parseInt((location.hash || "").replace("#", ""), 10);
  show(Number.isFinite(initial) && initial >= 1 && initial <= STOPS.length ? initial - 1 : 0);
})();
