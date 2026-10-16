/* English by default. The EN / 中文 switch stores the choice in localStorage. */
(function () {
  var STORAGE_KEY = "site-lang";

  var STRINGS = {
    en: {
      "meta.title.home": "simd-anim",
      "meta.title.fmopa": "FMOPA · simd-anim",
      "meta.desc.home": "A static lab that animates real SIMD and SME instructions so you can see data move through registers and tiles.",
      "meta.desc.fmopa": "Play the SME outer product fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s as it accumulates into a 4×4 ZA tile.",
      "skip": "Skip to main content",
      "nav.demos": "Demos",
      "nav.label": "Primary",
      "lang.label": "Language",
      "home.eyebrow": "Instruction lab",
      "home.lede": "A small static lab that animates real SIMD and SME instructions, so you can see data move through registers and tiles.",
      "home.catalog": "Demos",
      "home.more": "More pages will follow.",
      "status.live": "Live",
      "status.planned": "Planned",
      "cat.fmopa.family": "SME",
      "cat.fmopa.blurb": "Outer product of z0.s and z1.s, accumulated into a 4×4 ZA tile.",
      "cat.fmopa.go": "Play this instruction",
      "cat.load.family": "SVE",
      "cat.load.title": "Vector load / pack",
      "cat.load.blurb": "Bring memory into a Z register, lane by lane, then pack those lanes.",
      "cat.fmla.family": "SVE",
      "cat.fmla.title": "FMLA",
      "cat.fmla.blurb": "A fused multiply-add along a predicated vector.",
      "cat.store.family": "SME",
      "cat.store.title": "Store",
      "cat.store.blurb": "Write one horizontal slice of a ZA tile back to memory.",
      "footer.by": "A lab by Hou Yuteng",
      "footer.source": "Source",
      "fmopa.back": "All demos",
      "fmopa.eyebrow": "SME · outer product",
      "fmopa.lede": "z0.s runs down the rows, z1.s runs across the columns, and each product is added into the ZA tile.",
      "fmopa.insnLabel": "Instruction",
      "fmopa.play": "Play",
      "fmopa.pause": "Pause",
      "fmopa.resume": "Resume",
      "fmopa.replay": "Replay",
      "fmopa.random": "Randomize",
      "fmopa.starting": "Running FMOPA…",
      "fmopa.modeLabel": "View",
      "fmopa.modeStep": "Step-by-step",
      "fmopa.modeParallel": "Parallel",
      "fmopa.stepBack": "Step back",
      "fmopa.stepFwd": "Step forward",
      "fmopa.kbdHint": "Arrow keys step, space plays or pauses (step-by-step view).",
      "fmopa.parallelCounter": "1 instruction",
      "fmopa.parallelCaption": "One instruction: every active pair is multiplied and added in the same step.",
      "fmopa.parallelDone": "Done in one instruction. ZA[i, j] = start + z0.s[i] × z1.s[j] wherever both lanes are active; the other elements keep their values.",
      "fmopa.predGroup0": "p0/m, row predicate. Click a bit to toggle it.",
      "fmopa.predGroup1": "p1/m, column predicate. Click a bit to toggle it.",
      "fmopa.predLane0": "p0 lane {n}",
      "fmopa.predLane1": "p1 lane {n}",
      "fmopa.annReset": "Predicate changed. The tile is back to its starting values.",
      "fmopa.annRandom": "New values drawn. The tile starts over.",
      "fmopa.annPaused": "Paused at step {n} of {total}.",
      "fmopa.step": "{n} / {total}",
      "fmopa.idle": "Ready. The tile still holds the values it had before this FMOPA.",
      "fmopa.stepCaption": "Row {r}, column {c}: ZA ← {before} + {a} × {b} = {after}.",
      "fmopa.skipCaption": "Row {r}, column {c}: a predicate lane is 0, so /m keeps ZA at {before}.",
      "fmopa.done": "Done. Each ZA[i, j] is its starting value plus z0.s[i] × z1.s[j]. Replay runs the same FMOPA again from those starting values.",
      "fmopa.doneReduced": "Done, without motion. Each ZA[i, j] is its starting value plus z0.s[i] × z1.s[j].",
      "fmopa.motion": "This browser prefers reduced motion. Play still runs the instruction, and the tile jumps straight to the result.",
      "fmopa.tileAria": "ZA tile za.s[w11, 0], 4 by 4 single-precision elements",
      "fmopa.cell": "row {r}, column {c}, value {value}",
      "fmopa.notesTitle": "Reading the picture",
      "fmopa.note1.title": "Outer product, then add",
      "fmopa.note1.body": "For each row i and column j the instruction does ZA[i, j] += z0.s[i] × z1.s[j]. It accumulates. It does not wipe the tile first. Lanes are numbered from 0.",
      "fmopa.note2.title": "Predicates",
      "fmopa.note2.body": "p0/m governs rows, one lane for each element of z0.s. p1/m governs columns, one lane for each element of z1.s. The tile element changes only when both lanes are active; otherwise /m leaves it as it was. Click a predicate bit to switch that lane off and watch it happen.",
      "fmopa.note3.title": "Why 4×4",
      "fmopa.note3.body": "za.s[w11, 0] names the single-precision ZA tile selected by W11 plus offset 0. Drawn at a streaming vector length of 128 bits, a .s vector has four lanes and that tile is 4×4.",
      "fmopa.note4.title": "On real hardware",
      "fmopa.note4.body": "FMOPA accumulates in single precision with rounding, and it is one instruction: every active pair is multiplied and added in the same step. This page uses small integers so every value stays exact and readable.",
      "fmopa.valuesTpl": "This pass uses z0.s = {z0} and z1.s = {z1}."
    },
    zh: {
      "meta.title.home": "simd-anim",
      "meta.title.fmopa": "FMOPA · simd-anim",
      "meta.desc.home": "一个静态实验站，把真实的 SIMD 与 SME 指令做成动画，看数据怎样流过寄存器和 tile。",
      "meta.desc.fmopa": "播放 SME 外积指令 fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s，看它怎样累加进一块 4×4 的 ZA tile。",
      "skip": "跳到主要内容",
      "nav.demos": "演示",
      "nav.label": "主导航",
      "lang.label": "语言",
      "home.eyebrow": "指令实验台",
      "home.lede": "一个小型静态实验站，把真实的 SIMD 与 SME 指令做成动画，让你看见数据怎样在寄存器和 tile 之间移动。",
      "home.catalog": "演示",
      "home.more": "后面还会加页面。",
      "status.live": "可播放",
      "status.planned": "计划中",
      "cat.fmopa.family": "SME",
      "cat.fmopa.blurb": "z0.s 与 z1.s 做外积，累加进一块 4×4 的 ZA tile。",
      "cat.fmopa.go": "播放这条指令",
      "cat.load.family": "SVE",
      "cat.load.title": "向量装载 / 打包",
      "cat.load.blurb": "把内存按通道装进 Z 寄存器，再把这些通道打包。",
      "cat.fmla.family": "SVE",
      "cat.fmla.title": "FMLA",
      "cat.fmla.blurb": "在谓词控制下，沿一条向量做乘加。",
      "cat.store.family": "SME",
      "cat.store.title": "存储",
      "cat.store.blurb": "把 ZA tile 的一行水平切片写回内存。",
      "footer.by": "侯宇腾的实验台",
      "footer.source": "源代码",
      "fmopa.back": "全部演示",
      "fmopa.eyebrow": "SME · 外积",
      "fmopa.lede": "z0.s 沿行向下，z1.s 沿列向右，每个乘积都加进 ZA tile。",
      "fmopa.insnLabel": "指令",
      "fmopa.play": "播放",
      "fmopa.pause": "暂停",
      "fmopa.resume": "继续",
      "fmopa.replay": "重播",
      "fmopa.random": "换一组数",
      "fmopa.starting": "正在执行 FMOPA…",
      "fmopa.modeLabel": "视角",
      "fmopa.modeStep": "逐格",
      "fmopa.modeParallel": "并行",
      "fmopa.stepBack": "上一步",
      "fmopa.stepFwd": "下一步",
      "fmopa.kbdHint": "方向键单步，空格播放或暂停（逐格视角）。",
      "fmopa.parallelCounter": "1 条指令",
      "fmopa.parallelCaption": "一条指令：所有有效的行列配对在同一步里同时乘加。",
      "fmopa.parallelDone": "一条指令完成。两路谓词都有效处 ZA[i, j] = 起始值 + z0.s[i] × z1.s[j]；其余元素保持原值。",
      "fmopa.predGroup0": "p0/m，行谓词。点击某一位即可开关。",
      "fmopa.predGroup1": "p1/m，列谓词。点击某一位即可开关。",
      "fmopa.predLane0": "p0 第 {n} 路",
      "fmopa.predLane1": "p1 第 {n} 路",
      "fmopa.annReset": "谓词已修改，tile 已回到起始值。",
      "fmopa.annRandom": "已换一组数，tile 从头开始。",
      "fmopa.annPaused": "已暂停在第 {n} / {total} 步。",
      "fmopa.step": "{n} / {total}",
      "fmopa.idle": "准备好了。tile 里还是这条 FMOPA 执行前的数值。",
      "fmopa.stepCaption": "第 {r} 行、第 {c} 列：ZA ← {before} + {a} × {b} = {after}。",
      "fmopa.skipCaption": "第 {r} 行、第 {c} 列：有一路谓词为 0，/m 保持 ZA 原值 {before}。",
      "fmopa.done": "完成。每个 ZA[i, j] 等于起始值加上 z0.s[i] × z1.s[j]。重播会从同一组起始值再执行一次这条 FMOPA。",
      "fmopa.doneReduced": "完成，没有动画。每个 ZA[i, j] 等于起始值加上 z0.s[i] × z1.s[j]。",
      "fmopa.motion": "这个浏览器偏好减少动态效果。播放仍会执行这条指令，tile 会直接跳到结果。",
      "fmopa.tileAria": "ZA tile za.s[w11, 0]，4×4 个单精度元素",
      "fmopa.cell": "第 {r} 行、第 {c} 列，值 {value}",
      "fmopa.notesTitle": "怎么看这张图",
      "fmopa.note1.title": "先外积，再累加",
      "fmopa.note1.body": "对每个行 i、列 j，指令做的是 ZA[i, j] += z0.s[i] × z1.s[j]。这是累加，不会先把 tile 清掉。通道从 0 开始编号。",
      "fmopa.note2.title": "谓词",
      "fmopa.note2.body": "p0/m 管行，对应 z0.s 的每个元素；p1/m 管列，对应 z1.s 的每个元素。只有两路都有效，tile 上的那个元素才会改写，否则 /m 保持原值。点击谓词上的某一位把它关掉，亲眼看它保持不变。",
      "fmopa.note3.title": "为什么是 4×4",
      "fmopa.note3.body": "za.s[w11, 0] 指的是由 W11 加上偏移 0 选出的单精度 ZA tile。按 128 位的 streaming 向量长度来画，一条 .s 向量有四个通道，这块 tile 就是 4×4。",
      "fmopa.note4.title": "真实硬件上",
      "fmopa.note4.body": "真实 FMOPA 按单精度累加、有舍入，而且它是一条指令：所有有效配对在同一步里同时乘加。本页特意用小整数，让每个值都精确可读。",
      "fmopa.valuesTpl": "这一次 z0.s = {z0}，z1.s = {z1}。"
    }
  };

  function readLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "zh" || saved === "en") return saved;
    } catch (error) {
      /* fall through to the browser language */
    }
    var nav = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
    return String(nav).toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function storeLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      /* Private mode still switches for this view. */
    }
  }

  var current = "en";

  function apply(lang) {
    current = lang === "zh" ? "zh" : "en";
    var pack = STRINGS[current];
    document.documentElement.lang = current === "zh" ? "zh-Hans" : "en";

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (pack[key] != null) node.textContent = pack[key];
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-aria");
      if (pack[key] != null) node.setAttribute("aria-label", pack[key]);
    });

    document.querySelectorAll("[data-i18n-content]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-content");
      if (pack[key] != null) node.setAttribute("content", pack[key]);
    });

    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      var titleKey = titleEl.getAttribute("data-i18n");
      if (pack[titleKey] != null) document.title = pack[titleKey];
    }

    document.querySelectorAll(".lang-switch button").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-lang") === current ? "true" : "false");
    });

    document.dispatchEvent(new CustomEvent("site-lang", { detail: { lang: current } }));
  }

  window.siteI18n = {
    lang: function () {
      return current;
    },
    t: function (key) {
      var pack = STRINGS[current] || STRINGS.en;
      if (pack[key] != null) return pack[key];
      if (STRINGS.en[key] != null) return STRINGS.en[key];
      return key;
    }
  };

  try {
    apply(readLang());
  } finally {
    document.documentElement.classList.remove("i18n-wait");
  }

  document.querySelectorAll(".lang-switch button").forEach(function (button) {
    button.addEventListener("click", function () {
      var lang = button.getAttribute("data-lang");
      if (lang !== "en" && lang !== "zh") return;
      apply(lang);
      storeLang(lang);
    });
  });
})();
