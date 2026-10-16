/* English by default. The EN / 中文 switch stores the choice in localStorage. */
(function () {
  var STORAGE_KEY = "site-lang";

  var STRINGS = {
    en: {
      "meta.title.home": "simd-anim",
      "meta.title.fmopa": "FMOPA · simd-anim",
      "meta.desc.home": "A static lab that animates real SIMD and SME instructions so you can see data move through registers and tiles.",
      "meta.desc.fmopa": "Play the SME outer product fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s as it accumulates into a 4×4 ZA tile.",
      "meta.title.ld1w": "LD1W · simd-anim",
      "meta.desc.ld1w": "Play the SVE predicated load ld1w { z0.s }, p0/z, [x0] as words move from memory into a Z register.",
      "meta.title.fmla": "FMLA · simd-anim",
      "meta.desc.fmla": "Play the SVE fused multiply-add fmla z0.s, p0/m, z1.s, z2.s lane by lane.",
      "meta.title.st1w": "ZA store · simd-anim",
      "meta.desc.st1w": "Play the SME slice store st1w { za0h.s[w12, 0] }, p0, [x0] writing one row of a ZA tile back to memory.",
      "skip": "Skip to main content",
      "nav.demos": "Demos",
      "nav.label": "Primary",
      "lang.label": "Language",
      "home.eyebrow": "Instruction lab",
      "home.lede": "A small static lab that animates real SIMD and SME instructions, so you can see data move through registers and tiles.",
      "home.catalog": "Demos",
      "home.more": "More pages will follow.",
      "status.live": "Live",
      "cat.fmopa.family": "SME",
      "cat.fmopa.blurb": "Outer product of z0.s and z1.s, accumulated into a 4×4 ZA tile.",
      "cat.fmopa.go": "Play this instruction",
      "cat.load.go": "Play this instruction",
      "cat.fmla.go": "Play this instruction",
      "cat.store.go": "Play this instruction",
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
      "fmopa.valuesTpl": "This pass uses z0.s = {z0} and z1.s = {z1}.",
      "ui.play": "Play",
      "ui.pause": "Pause",
      "ui.resume": "Resume",
      "ui.replay": "Replay",
      "ui.random": "Randomize",
      "ui.stepBack": "Step back",
      "ui.stepFwd": "Step forward",
      "ui.kbdHint": "Arrow keys step, space plays or pauses.",
      "ui.starting": "Running the instruction…",
      "ui.insnLabel": "Instruction",
      "ui.back": "All demos",
      "ui.notesTitle": "Reading the picture",
      "ui.paused": "Paused at step {n} of {total}.",
      "ui.annReset": "Inputs changed. Back to the starting state.",
      "ui.annRandom": "New values drawn. Starting over.",
      "ui.motion": "This browser prefers reduced motion. Play still runs the instruction and jumps straight to the result.",
      "ui.step": "{n} / {total}",
      "ui.predGroup": "Predicate. Click a bit to toggle it.",
      "ui.predLane": "p0 lane {n}",
      "fmla.eyebrow": "SVE · fused multiply-add",
      "fmla.lede": "z1.s and z2.s multiply lane by lane, and every active product lands in z0.s.",
      "fmla.zAria": "z0.s accumulator, 4 single-precision lanes",
      "fmla.laneAria": "z0.s lane {lane}, value {value}",
      "fmla.idle": "Ready. z0.s still holds the values it had before this FMLA.",
      "fmla.stepCaption": "Lane {lane}: z0 ← {before} + {a} × {b} = {after}.",
      "fmla.skipCaption": "Lane {lane}: p0 is 0, so /m keeps z0 at {before}.",
      "fmla.done": "Done. Every active z0.s[i] gained z1.s[i] × z2.s[i]; inactive lanes kept their values.",
      "fmla.values": "This pass uses z1.s = {z1}, z2.s = {z2}, and z0.s = {z0} to start.",
      "fmla.note1.title": "Fused, lane by lane",
      "fmla.note1.body": "For each lane i the instruction does z0.s[i] += z1.s[i] × z2.s[i]. Fused means the product joins the accumulator without an intermediate rounding step.",
      "fmla.note2.title": "One predicate, /m",
      "fmla.note2.body": "p0/m carries one bit per lane of z0.s. An inactive lane merges: z0 keeps its old value. Click a predicate bit to switch that lane off and watch it hold still.",
      "fmla.note3.title": "Contrast with FMOPA",
      "fmla.note3.body": "FMLA pairs lanes of two vectors — an element-wise multiply-add. FMOPA multiplies every row by every column — an outer product into ZA. Same family of idea, very different shape.",
      "ld1w.eyebrow": "SVE · vector load",
      "ld1w.lede": "Contiguous words walk from memory into z0.s; lanes whose predicate bit is 0 are filled with zero.",
      "ld1w.memAria": "Memory words at x0",
      "ld1w.zAria": "z0.s destination, 4 single-precision lanes",
      "ld1w.laneAria": "z0.s lane {lane}, value {value}",
      "ld1w.memWordAria": "memory word {index}, value {value}",
      "ld1w.idle": "Ready. z0.s still holds the values it had before this load.",
      "ld1w.stepCaption": "Lane {lane}: z0 ← mem[x0 + {off}] = {value}.",
      "ld1w.skipCaption": "Lane {lane}: p0 is 0, so /z fills z0 with 0 — that word is never read.",
      "ld1w.done": "Done. The active lanes hold mem[x0], mem[x0,#4], mem[x0,#8], mem[x0,#12]; the rest are zero.",
      "ld1w.values": "This pass reads {mem} and overwrites z0.s = {z0}.",
      "ld1w.note1.title": "Contiguous addressing",
      "ld1w.note1.body": "Element i loads from x0 + 4 × i: one word per .s lane, walking memory in order. Four active lanes cover exactly sixteen bytes.",
      "ld1w.note2.title": "Zeroing with /z",
      "ld1w.note2.body": "Loads take /z, not /m: an inactive lane is written with 0 instead of keeping its old value. Click a predicate bit and watch that lane reset to zero. Compare with FMLA and FMOPA, which merge.",
      "ld1w.note3.title": "No stray reads",
      "ld1w.note3.body": "Predicated-off elements cause no memory access at all. The dimmed words at [x0,#16] and [x0,#20] are never touched, no matter what they hold.",
      "st1w.eyebrow": "SME · slice store",
      "st1w.lede": "W12 picks a horizontal slice of the ZA tile; its active elements walk out to memory at x0.",
      "st1w.sliceLabel": "W12 slice selector",
      "st1w.tileAria": "ZA tile za0.s, 4 by 4 single-precision elements",
      "st1w.cellAria": "row {r}, column {c}, value {value}",
      "st1w.memAria": "Memory words at x0",
      "st1w.memWordAria": "memory word {index}, value {value}",
      "st1w.idle": "Ready. Memory still holds the values it had before this store.",
      "st1w.stepCaption": "Element {j}: mem[x0 + {off}] ← ZA[w12={r}, {j}] = {value}.",
      "st1w.skipCaption": "Element {j}: p0 is 0, so memory keeps {before}.",
      "st1w.done": "Done. The active elements of row {r} now sit in memory at x0.",
      "st1w.values": "This pass stores row {r} of the tile into memory starting as {mem}.",
      "st1w.note1.title": "Choosing the slice",
      "st1w.note1.body": "za0h.s names a horizontal slice of the ZA tile, and W12 says which one: row w12 of za0.s. The selector above changes W12 — watch the highlighted slice move.",
      "st1w.note2.title": "A store has no /z",
      "st1w.note2.body": "p0 alone governs the elements: active ones are written, inactive ones leave memory exactly as it was. There is nothing to zero — memory already holds something.",
      "st1w.note3.title": "Closing the loop",
      "st1w.note3.body": "Pair this with FMOPA and LD1W: load operands, build a product in ZA, then store one slice of the result back to memory. That is an entire SME kernel in three instructions."
    },
    zh: {
      "meta.title.home": "simd-anim",
      "meta.title.fmopa": "FMOPA · simd-anim",
      "meta.desc.home": "一个静态实验站，把真实的 SIMD 与 SME 指令做成动画，看数据怎样流过寄存器和 tile。",
      "meta.desc.fmopa": "播放 SME 外积指令 fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s，看它怎样累加进一块 4×4 的 ZA tile。",
      "meta.title.ld1w": "LD1W · simd-anim",
      "meta.desc.ld1w": "播放 SVE 谓词装载指令 ld1w { z0.s }, p0/z, [x0]，看字怎样从内存走进 Z 寄存器。",
      "meta.title.fmla": "FMLA · simd-anim",
      "meta.desc.fmla": "逐通道播放 SVE 融合乘加指令 fmla z0.s, p0/m, z1.s, z2.s。",
      "meta.title.st1w": "ZA 存储 · simd-anim",
      "meta.desc.st1w": "播放 SME 切片存储指令 st1w { za0h.s[w12, 0] }, p0, [x0]，把 ZA tile 的一行写回内存。",
      "skip": "跳到主要内容",
      "nav.demos": "演示",
      "nav.label": "主导航",
      "lang.label": "语言",
      "home.eyebrow": "指令实验台",
      "home.lede": "一个小型静态实验站，把真实的 SIMD 与 SME 指令做成动画，让你看见数据怎样在寄存器和 tile 之间移动。",
      "home.catalog": "演示",
      "home.more": "后面还会加页面。",
      "status.live": "可播放",
      "cat.fmopa.family": "SME",
      "cat.fmopa.blurb": "z0.s 与 z1.s 做外积，累加进一块 4×4 的 ZA tile。",
      "cat.fmopa.go": "播放这条指令",
      "cat.load.go": "播放这条指令",
      "cat.fmla.go": "播放这条指令",
      "cat.store.go": "播放这条指令",
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
      "fmopa.valuesTpl": "这一次 z0.s = {z0}，z1.s = {z1}。",
      "ui.play": "播放",
      "ui.pause": "暂停",
      "ui.resume": "继续",
      "ui.replay": "重播",
      "ui.random": "换一组数",
      "ui.stepBack": "上一步",
      "ui.stepFwd": "下一步",
      "ui.kbdHint": "方向键单步，空格播放或暂停。",
      "ui.starting": "正在执行指令…",
      "ui.insnLabel": "指令",
      "ui.back": "全部演示",
      "ui.notesTitle": "怎么看这张图",
      "ui.paused": "已暂停在第 {n} / {total} 步。",
      "ui.annReset": "输入已修改，回到起始状态。",
      "ui.annRandom": "已换一组数，从头开始。",
      "ui.motion": "这个浏览器偏好减少动态效果。播放仍会执行指令，并直接跳到结果。",
      "ui.step": "{n} / {total}",
      "ui.predGroup": "谓词。点击某一位即可开关。",
      "ui.predLane": "p0 第 {n} 路",
      "fmla.eyebrow": "SVE · 融合乘加",
      "fmla.lede": "z1.s 与 z2.s 逐通道相乘，每个有效的乘积都加进 z0.s。",
      "fmla.zAria": "z0.s 累加寄存器，4 个单精度通道",
      "fmla.laneAria": "z0.s 第 {lane} 通道，值 {value}",
      "fmla.idle": "准备好了。z0.s 里还是这条 FMLA 执行前的数值。",
      "fmla.stepCaption": "第 {lane} 通道：z0 ← {before} + {a} × {b} = {after}。",
      "fmla.skipCaption": "第 {lane} 通道：p0 为 0，/m 保持 z0 原值 {before}。",
      "fmla.done": "完成。每个有效的 z0.s[i] 都加上了 z1.s[i] × z2.s[i]；无效通道保持原值。",
      "fmla.values": "这一次 z1.s = {z1}，z2.s = {z2}，z0.s 起始为 {z0}。",
      "fmla.note1.title": "逐通道融合乘加",
      "fmla.note1.body": "对每个通道 i，指令做的是 z0.s[i] += z1.s[i] × z2.s[i]。融合（Fused）指乘积不经中间舍入直接加进累加器。",
      "fmla.note2.title": "一个谓词，/m",
      "fmla.note2.body": "p0/m 为 z0.s 的每个通道带一位。无效通道走合并（merging）：z0 保持旧值。点一位把它关掉，看它原地不动。",
      "fmla.note3.title": "与 FMOPA 对比",
      "fmla.note3.body": "FMLA 是两向量对应通道配对的逐元素乘加；FMOPA 是每一行乘每一列的外积，写进 ZA。思路同源，形状完全不同。",
      "ld1w.eyebrow": "SVE · 向量装载",
      "ld1w.lede": "连续的字从内存走进 z0.s；谓词为 0 的通道被填成零。",
      "ld1w.memAria": "x0 处的内存字",
      "ld1w.zAria": "z0.s 目的寄存器，4 个单精度通道",
      "ld1w.laneAria": "z0.s 第 {lane} 通道，值 {value}",
      "ld1w.memWordAria": "第 {index} 个内存字，值 {value}",
      "ld1w.idle": "准备好了。z0.s 里还是装载前的旧值。",
      "ld1w.stepCaption": "第 {lane} 通道：z0 ← mem[x0 + {off}] = {value}。",
      "ld1w.skipCaption": "第 {lane} 通道：p0 为 0，/z 把 z0 填成 0——那个字根本不会被读。",
      "ld1w.done": "完成。有效通道装的是 mem[x0]、mem[x0,#4]、mem[x0,#8]、mem[x0,#12]；其余为零。",
      "ld1w.values": "这一次读入 {mem}，覆盖原来的 z0.s = {z0}。",
      "ld1w.note1.title": "连续寻址",
      "ld1w.note1.body": "第 i 个元素从 x0 + 4 × i 装载：每个 .s 通道一个字，按顺序走过内存。四个有效通道恰好覆盖十六个字节。",
      "ld1w.note2.title": "/z 填零",
      "ld1w.note2.body": "装载用 /z 而不是 /m：无效通道被直接写成 0，而不是保留旧值。点一位谓词，看那条通道归零。对比 FMLA 与 FMOPA 的合并语义。",
      "ld1w.note3.title": "不多读一个字",
      "ld1w.note3.body": "被谓词关掉的元素完全不访问内存。变暗的 [x0,#16] 和 [x0,#20] 永远不会被碰到，无论里面是什么。",
      "st1w.eyebrow": "SME · 切片存储",
      "st1w.lede": "W12 选出 ZA tile 的一条水平切片；其中有效的元素依次写入 x0 处的内存。",
      "st1w.sliceLabel": "W12 切片选择器",
      "st1w.tileAria": "ZA tile za0.s，4×4 个单精度元素",
      "st1w.cellAria": "第 {r} 行、第 {c} 列，值 {value}",
      "st1w.memAria": "x0 处的内存字",
      "st1w.memWordAria": "第 {index} 个内存字，值 {value}",
      "st1w.idle": "准备好了。内存里还是存储前的旧值。",
      "st1w.stepCaption": "第 {j} 个元素：mem[x0 + {off}] ← ZA[w12={r}, {j}] = {value}。",
      "st1w.skipCaption": "第 {j} 个元素：p0 为 0，内存保持 {before}。",
      "st1w.done": "完成。第 {r} 行的有效元素已经落到 x0 处的内存里。",
      "st1w.values": "这一次把 tile 的第 {r} 行存进内存，内存起始为 {mem}。",
      "st1w.note1.title": "选出切片",
      "st1w.note1.body": "za0h.s 指 ZA tile 的一条水平切片，W12 决定是哪一条：za0.s 的第 w12 行。上面的选择器可以改 W12——看高亮的切片移动。",
      "st1w.note2.title": "存储没有 /z",
      "st1w.note2.body": "p0 单独控制元素：有效位写入，无效位让内存原样不动。也没有什么可填零——内存里本来就有值。",
      "st1w.note3.title": "闭环",
      "st1w.note3.body": "把它和 FMOPA、LD1W 连起来：装载操作数、在 ZA 里做出乘积、再把结果的一片切回内存。三条指令就是一个完整的 SME 内核。"
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
