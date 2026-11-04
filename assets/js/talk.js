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
     vocabulary -> the SVE ideas -> the SME outer product -> composition
     -> the two strategy pages that say what speed actually is. */
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
      href: "../strategy/sme-anatomy/",
      title: { en: "The hardware — Z, ZA, compute", zh: "硬件词汇 —— Z、ZA、计算单元" },
      cue: {
        en: "Zoom in from the map: what a z register and a ZA tile actually look like, and how the compute unit wires them together.",
        zh: "从全景拉近：z 寄存器和 ZA tile 到底长什么样，计算单元怎么把它们接起来。",
      },
    },
    {
      kind: "page",
      href: "../instructions/whilelt/",
      title: { en: "WHILELT — where predicates come from", zh: "WHILELT —— 谓词从哪来" },
      cue: {
        en: "A predicate is just bits: lane i is on while x0 + i < x1. Step x0 live with the steppers.",
        zh: "谓词就是一组比特：x0 + i < x1 时第 i 通道亮。用步进器现场改 x0。",
      },
    },
    {
      kind: "page",
      href: "../instructions/ld1w/",
      title: { en: "LD1W — a predicated load", zh: "LD1W —— 带谓词的加载" },
      cue: {
        en: "Active lanes read memory, /z zeroes the rest. Click a predicate bit mid-animation.",
        zh: "激活通道读内存，/z 把其余清零。动画进行中点掉一个谓词位看效果。",
      },
    },
    {
      kind: "page",
      href: "../instructions/fmopa/",
      title: { en: "FMOPA — the outer product", zh: "FMOPA —— 外积" },
      cue: {
        en: "The star: ZA[i,j] += z0[i] x z1[j]. Play step-by-step, then switch to Parallel — one instruction, 16 FMAs.",
        zh: "主角：ZA[i,j] += z0[i] × z1[j]。先逐步播放，再切 Parallel —— 一条指令 16 个乘加。",
      },
    },
    {
      kind: "page",
      href: "../instructions/fmla/",
      title: { en: "FMLA — lane-wise, for contrast", zh: "FMLA —— 逐通道，作对比" },
      cue: {
        en: "SVE's vector FMA for contrast: vectors in, vectors out — no tile, no accumulation across rows.",
        zh: "对比 SVE 的向量 FMA：向量进向量出 —— 没有 tile，也不跨行累加。",
      },
    },
    {
      kind: "page",
      href: "../instructions/st1w/",
      title: { en: "ST1W — results leave ZA", zh: "ST1W —— 结果写回" },
      cue: {
        en: "One slice at a time; w12 picks the row. Flip the selector and replay.",
        zh: "结果按切片离开 ZA，w12 选行。切换选择器再重放一次。",
      },
    },
    {
      kind: "page",
      href: "../kernels/microkernel/",
      title: { en: "Microkernel — compose everything", zh: "Microkernel —— 全部拼起来" },
      cue: {
        en: "pack -> ldr + fmopa loop -> store. Toggle the layout selectors: it survives every transpose state.",
        zh: "pack → ldr+fmopa 循环 → 存储。切换布局选择器：四种转置状态都成立。",
      },
    },
    {
      kind: "page",
      href: "../strategy/roofline/",
      title: { en: "Roofline — what limits you", zh: "Roofline —— 谁限制了你" },
      cue: {
        en: "Drag the sliders: past the ridge, more bandwidth buys nothing — arithmetic intensity is the currency.",
        zh: "拖动滑块：过了脊点，再加带宽也没用 —— 计算强度才是硬通货。",
      },
    },
    {
      kind: "page",
      href: "../strategy/memory-flow/",
      title: { en: "Memory in flight", zh: "内存时序" },
      cue: {
        en: "Latency hides across kernels: prefetch ahead, never read what you overwrite, let the tail hide.",
        zh: "延迟要跨 kernel 藏：提前预取、不读将被覆盖的数据、让尾巴藏进下一个 kernel。",
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

  /* Hidden inside every page stop: the site header/footer and the back
     link, plus the types note (the speaker narrates it; it stays in the
     notes section below). Scaling to fit is applied by fitFrame() below. */
  var FRAME_CSS =
    ".skip-link,.site-header,.site-footer,.back,.spec-note{display:none !important;}" +
    ".page{width:min(100% - 2rem,76rem);}" +
    ".demo-head{padding:0.4rem 0 0.7rem;}" +
    ".demo-head h1{font-size:clamp(2.4rem,5.5vw,3.6rem);}" +
    ".demo-head .lede{font-size:1rem;}" +
    ".insn{margin-bottom:0.8rem;}";

  /* Projectors are one screen, no scrolling: scale each page so its stage
     and playback controls land inside the viewport. Measured against the
     controls (falling back to the bench), clamped so text never gets
     absurdly small or huge, and re-run when the window resizes. */
  function fitFrame(iframe) {
    var doc = null;
    try {
      doc = iframe.contentDocument;
    } catch (error) {
      doc = null;
    }
    if (!doc || !doc.body) return;
    var anchor =
      doc.querySelector(".controls") || doc.querySelector(".bench") || doc.querySelector("main");
    var vh = doc.documentElement.clientHeight || 0;
    if (!anchor || vh < 400) return;
    doc.body.style.zoom = "";
    var bottom = anchor.getBoundingClientRect().bottom;
    if (bottom < 1) return;
    var target = Math.min(1.3, Math.max(0.72, (vh * 0.96) / bottom));
    doc.body.style.zoom = String(target);
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
  var regCaption = document.querySelector("[data-reg-caption]");
  var cueTitle = document.querySelector("[data-stop-title]");
  var cueText = document.querySelector("[data-cue-text]");
  var counterBtn = document.querySelector("[data-counter]");
  var overviewEl = document.querySelector("[data-overview]");
  var overviewList = document.querySelector("[data-overview-list]");
  var blackoutEl = document.querySelector("[data-blackout-layer]");

  var frames = {}; /* stop index -> iframe, kept alive once created */
  var current = -1;

  /* Register-map reveal: 0 all four families, 1-4 one family each,
     5 the data path. Arrow keys and clicks drive it; N/P still move
     stops, so the card and the talk clock stay out of each other's way. */
  var REG_CAPTIONS = [
    "talk.regStep0",
    "talk.regStep1",
    "talk.regStep2",
    "talk.regStep3",
    "talk.regStep4",
    "talk.regStep5",
  ];

  function setRegistersStep(n) {
    n = Math.max(0, Math.min(REG_CAPTIONS.length - 1, n));
    registersCard.setAttribute("data-step", String(n));
    regCaption.textContent = t(REG_CAPTIONS[n]);
  }

  function onRegistersStop() {
    return (
      current >= 0 &&
      STOPS[current].kind === "card" &&
      STOPS[current].id === "registers"
    );
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
    if (!registersCard.hidden) setRegistersStep(0);

    var active = ensureFrame(current);
    Object.keys(frames).forEach(function (key) {
      frames[key].classList.toggle("is-active", frames[key] === active);
    });

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
    /* On the register card the arrows and space walk the reveal; every
       other stop hands those keys to the page animation instead. The
       overview must be closed first, so arrows never fight its list. */
    if (onRegistersStop() && overviewEl.hidden && (key === "ArrowRight" || key === " ")) {
      event.preventDefault();
      setRegistersStep(Number(registersCard.getAttribute("data-step")) + 1);
      return;
    }
    if (onRegistersStop() && overviewEl.hidden && key === "ArrowLeft") {
      event.preventDefault();
      setRegistersStep(Number(registersCard.getAttribute("data-step")) - 1);
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

  /* Clicking a family card jumps the reveal to that family. */
  var FAM_ORDER = ["x", "p", "z", "za"];
  registersCard.querySelectorAll(".reg-fam").forEach(function (fam) {
    fam.addEventListener("click", function () {
      var idx = FAM_ORDER.indexOf(fam.getAttribute("data-fam"));
      if (idx >= 0) setRegistersStep(idx + 1);
    });
  });

  /* i18n dispatches this after every language change: the data-i18n spans
     re-rendered themselves, the shell data and live frames follow here. */
  document.addEventListener("site-lang", function () {
    titleCard.querySelector("[data-card-date]").textContent = DATE;
    if (!registersCard.hidden) {
      setRegistersStep(Number(registersCard.getAttribute("data-step")));
    }
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
