# simd-anim

[![CI and Pages](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml/badge.svg)](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml)

A static lab for interactive animations of ARM SIMD and SME instructions, organized in three tiers: **instructions** (one real instruction per page, watched as values move through Z registers, predicates, and ZA tiles), **kernels** (instructions composed into a working GEMM microkernel), and **strategy** (the machine-level ideas that decide what a kernel can reach).

This repository is a synced standalone deploy of [`lab/`](https://github.com/0tomhoyt/personal_web/tree/main/lab) in [personal_web](https://github.com/0tomhoyt/personal_web). The primary live URL is <https://arm-simd.houyuteng.com>. The editing source of truth remains personal_web `lab/` (this mirror is refreshed from that tree, currently personal_web [`e33fe76`](https://github.com/0tomhoyt/personal_web/commit/e33fe76aeeed95490ec6cda505975e04b3569fbe)). The Vercel project simd-anim and GitHub Pages both serve this repository root.

Four abbreviations carry the whole site: **SVE** is the Scalable Vector Extension (the z registers and p predicates), **SME** the Scalable Matrix Extension (the ZA accumulator and the outer-product instructions), **SVL** the streaming vector length — how many bits one vector holds, 128 in every drawing here — and **ZA** the SME matrix accumulator. The home page defines the same four; every instruction drawn on a page is written exactly as an assembler takes it (checked against ARM DDI 0602 with `clang -march=armv9-a+sme2+fp16`).

English is the default. The EN / 中文 control on every page stores the choice in `localStorage` under `site-lang`; a first visit without a stored choice follows the browser language.

## Run locally

Open `index.html` in a browser, or serve the repository root so the page paths resolve the same way they will on a static host:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080/>. No build step. The site is plain HTML, CSS, and JavaScript.

`node tools/check.mjs` verifies internal links, the bilingual string table, and that any `.wasm` file is a real WebAssembly binary. CI runs the same check and publishes `main` to GitHub Pages on every push.

## Pages

| Path | What it shows |
| --- | --- |
| `/` | What this lab is, the three section catalogs, and the glossary of those four abbreviations |
| `/instructions/fmopa/` | SME outer product `fmopa za0.s, p0/m, p1/m, z0.s, z1.s` |
| `/instructions/ld1w/` | SVE predicated load `ld1w { z0.s }, p0/z, [x0]` — `/z` zeroing |
| `/instructions/fmla/` | SVE fused multiply-add `fmla z0.s, p0/m, z1.s, z2.s` — `/m` merging |
| `/instructions/st1w/` | SME slice store `st1w { za0h.s[w12, 0] }, p0, [x0]` — W12 picks the slice |
| `/instructions/whilelt/` | SVE predicate setup `whilelt p0.s, x0, x1` — scalar bounds become bits, with live x0/x1 steppers |
| `/instructions/addv/` | SVE integer reduction `uaddv d0, p0, z0.s` — active lanes collapse into one 64-bit scalar |
| `/instructions/uzp1/` | SVE deinterleave `uzp1 z0.s, z1.s, z2.s` — even elements of two vectors gather into one |
| `/instructions/gather/` | SVE gather load `ld1w { z0.s }, p0/z, [x0, z1.s, sxtw #2]` — each lane reads the word its own index selects |
| `/instructions/fmlal/` | SME2 widening multiply-add `fmlal za.s[w11, 4:5], z0.h, z1.h[2]` — half in, single out, with an index selector |
| `/instructions/addha/` | SME broadcast add `addha za0.s, p0/m, p1/m, z0.s` — one vector into every active row |
| `/instructions/tbl/` | SVE table lookup `tbl z0.s, { z1.s, z2.s }, z3.s` — any element, out of range gives zero |
| `/instructions/addva/` | SME vertical broadcast `addva za0.s, p0/m, p1/m, z0.s` — one vector into every active column |
| `/instructions/zip1/` | SVE interleave `zip1 z0.s, z1.s, z2.s` — the low halves of two vectors alternate into one |
| `/learn/` | Five-step intro to SME: optional linear-algebra self-check, then the hardware, the kernel tour, the microkernel, the roofline, and memory in flight |
| `/kernels/tour/` | One pass through the GEMM inner pipeline, linking the existing pages `whilelt → ld1w → fmopa → st1w` |
| `/kernels/microkernel/` | A GEMM microkernel in miniature (C = one 4 × 4 tile): pack (read → write, gather vs copy routes) → ldr + fmopa loop → st1w / stnt1w store, with the slices landing in memory; every value follows the four transpose states |
| `/strategy/sme-anatomy/` | The hardware vocabulary — a Z register, the ZA tile, and the compute unit, the three names every other page uses |
| `/strategy/roofline/` | Interactive roofline — peak compute and memory supply as the reader's own sliders; the ridge shows why arithmetic intensity, not raw FLOPs, decides what limits a kernel; and, once the page's bench has run, the visitor's own measured points — a dashed scalar FP64 sweep that sags once the working set outgrows the cache, and the WASM SIMD tier (f32×4, FP32) as accent dots sitting at twice the intensity |
| `/strategy/memory-flow/` | A four-row timeline (Core / L1 / L2 / HBM) playing one kernel's store drain and the next kernel's prefetch across the cache hierarchy |
| `/quiz/` | Optional three-question linear-algebra self-check |
| `/quiz/matmul/` | The primer behind the self-check: matrix multiply as rows, columns, and dot products |

The FMOPA page draws a single-precision ZA tile at a streaming vector length of 128 bits, so the tile is 4×4. `z0.s` is the column operand (the first source is the SVL×1 vector), `z1.s` is the row operand, and each active pair does `ZA[i, j] += z0.s[i] × z1.s[j]`. LD1W walks contiguous words from memory into a Z register and zeroes inactive lanes; FMLA pairs two vectors lane by lane and merges; ST1W writes one W12-selected slice of ZA back to memory; WHILELT shows where predicates come from; UADDV collapses lanes into a 64-bit scalar; UZP1 shuffles whole vectors with no predicate at all, and ZIP1 interleaves the low halves back. ADDVA is ADDHA's vertical twin: the same vector runs down every active column.

## Sizes and types

Every page draws one streaming vector length — SVL = 128 bits — and each page carries a note under the instruction naming the data types it shows. The arithmetic is uniform, so the same drawings scale cleanly to wider hardware:

| Quantity | SVL 128 (drawn) | SVL 512 |
| --- | --- | --- |
| `.s` lanes per Z register | 4 × 32-bit float | 16 |
| Predicate bits (`p0.s`, `whilelt` output) | 4 | 16 |
| FMOPA / ZA `.s` tile | 4 × 4 | 16 × 16 |
| `st1w` slice selector `w12` | 0…3 | 0…15 |
| Contiguous load/store window | 16 bytes | 64 bytes |
| `uaddv` destination `d0` | 64-bit scalar | 64-bit scalar |
| `fmlal` half-precision operands | 8 × 16-bit | 32 × 16-bit |
| `tbl` two-register table entries | 8 | 32 |
| `addva` vector into every column | 4 | 16 |
| `zip1` low-half interleave | 2 + 2 elements | 8 + 8 |

Scalars `x0`, `x1`, `w11`, `w12` live in 64-bit general-purpose registers; gather indices in `z1.s` are 32-bit signed and scaled ×4 (`sxtw #2`).

Every instruction and kernel page shares the same interactions:

- Predicate bits are clickable. `/m` pages show inactive elements keeping their values; the `/z` page shows them reset to zero; ST1W's unqualified `p0` simply does not write the inactive elements; on the reduction page an inactive lane counts as zero. Several pages start with one bit already off, so that behavior shows on the first play.
- Play is a play/pause toggle, Replay restarts, and the arrow keys (or the ← → buttons) step one element at a time, backwards included. Space plays or pauses.
- Randomize re-rolls the operands.
- Each page adds only the inputs its instruction needs: ST1W a W12 slice selector, WHILELT steppers for the scalar bounds x0 and x1, FMLAL an index selector for `z1.h[idx]`, TBL clickable index lanes, the microkernel two layout selectors (M×K / K×M and K×N / N×K), FMOPA a Step-by-step / Parallel view switch, and the memory-flow page a C write-once / C accumulate mode switch.
- If the browser prefers reduced motion, Play jumps straight to the result.
- The header's moon/sun toggle switches dark mode. The choice is stored locally (`site-theme`); a first visit follows the system preference, and an inline head script sets `data-theme` before the CSS paints, so there is no flash. The shared palette lives in `assets/css/site.css`; `assets/js/theme.js` wires the buttons and is the same file as the homepage's.

The animation clock and control wiring live in `assets/js/player.js` and are shared by all animated pages; each page only draws its own stage.

## Strategy

The header nav is Learn, then the taxonomy — Instructions, Kernels, Strategy. Learn opens the intro. Each taxonomy link lands on its section of the home page, and the section a page belongs to is marked current in the nav. Pages on the intro also mark Learn as the current step. The strategy pages: `/strategy/sme-anatomy/` — the hardware vocabulary (a register, the ZA tile, the compute unit) drawn once so the other pages can just use the names. `/strategy/roofline/` — an interactive roofline where peak compute and memory supply are the reader's own sliders, and the ridge between them shows why arithmetic intensity, not raw FLOPs, decides what limits a kernel. Its measured layer comes from the site bench: `bench-core.js` and `bench-simd.wasm` are vendored at this repository root (copied from the personal_web root, where the homepage bench uses the same files) so the page can measure in place — a scalar FP64 sweep over five sizes drawn as a dashed polyline, plus a WASM SIMD tier. The engine resolves the `.wasm` next to its own script URL. And `/strategy/memory-flow/` — a four-row timeline (Core / L1 / L2 / HBM) that plays one kernel's store drain and the next kernel's prefetch across the cache hierarchy. The page states its strategy first — three moves (prefetch ahead, never read what you overwrite, let the tail hide under the next kernel), each with its cost — and the timeline then makes each move checkable by eye: two-slot rails for transfers in flight, hit tags on the loads a prefetch served, and the one slot where HBM is asked for a read and a write at once (128 B against its 64 B budget).

Before the kernels, an optional pair warms up the linear algebra: `/quiz/` scores three questions on matrix shapes and dot products, and `/quiz/matmul/` is the primer it links to when the score needs it. `/learn/` puts that pair in front of one curriculum: hardware, the kernel tour, the microkernel, the roofline, and memory in flight.

## Roadmap

Shipped:

- Kernel tour at `/kernels/tour/`. It links the existing instruction pages in order — `whilelt → ld1w → fmopa → st1w` — with the same prev/next progress chrome as the intro. The microkernel page is still the composed kernel.
- Vertical broadcast at `/instructions/addva/`: `addva za0.s, p0/m, p1/m, z0.s`.
- Interleave at `/instructions/zip1/`: `zip1 z0.s, z1.s, z2.s`.
- Intro hub at `/learn/`: optional linear-algebra self-check, then five steps (hardware, kernel tour, microkernel, roofline, memory in flight).

## Deploy

The public site is <https://arm-simd.houyuteng.com>. The Vercel project simd-anim serves this repository root; <https://simd-anim.vercel.app> is only the Vercel default alias. GitHub Pages publishes `main` through `.github/workflows/pages.yml`. Keep the directory layout: pages link to `assets/` with relative paths.

Links that belong to the personal homepage stay on www.houyuteng.com. The byline ("A lab by Hou Yuteng") points at <https://www.houyuteng.com/>. Kernel-zoo cross-links point at <https://www.houyuteng.com/#zoo>. The roofline prompt that sends a reader to the homepage bench points at <https://www.houyuteng.com/#bench>. The footer Source link points at the [personal_web](https://github.com/0tomhoyt/personal_web) repository. Each page's canonical URL and `og:url` use the matching path under `https://arm-simd.houyuteng.com/…` (no `/lab` prefix).
