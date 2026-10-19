# simd-anim

> **Merged into [personal_web](https://github.com/0tomhoyt/personal_web).** This lab now lives at [personal-web-swart-zeta.vercel.app/lab/](https://personal-web-swart-zeta.vercel.app/lab/), imported with `git subtree` so the full history remains reachable from the personal_web repository. This repository is archived and read-only; the Pages snapshot stays up as the last standalone version.

[![CI and Pages](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml/badge.svg)](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml)

A static lab for interactive animations of ARM SIMD and SME instructions, organized in three tiers: **instructions** (one real instruction per page, watched as values move through Z registers, predicates, and ZA tiles), **kernels** (instructions composed into a working GEMM microkernel), and **strategy** (the machine-level ideas that decide what a kernel can reach).

Four abbreviations carry the whole site: **SVE** is the Scalable Vector Extension (the z registers and p predicates), **SME** the Scalable Matrix Extension (the ZA accumulator and the outer-product instructions), **SVL** the streaming vector length — how many bits one vector holds, 128 in every drawing here — and **ZA** the SME matrix accumulator. The home page defines the same four; every instruction drawn on a page is written exactly as an assembler takes it (checked against ARM DDI 0602 with `clang -march=armv9-a+sme2+fp16`).

English is the default. The EN / 中文 control on every page stores the choice in `localStorage` under `site-lang`; a first visit without a stored choice follows the browser language.

## Run locally

Open `index.html` in a browser, or serve the repository root so the page paths resolve the same way they will on a static host:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080/>. No build step. The site is plain HTML, CSS, and JavaScript.

`node tools/check.mjs` verifies internal links and the bilingual string table; CI runs the same check and publishes `main` to GitHub Pages on every push.

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
| `/kernels/microkernel/` | A GEMM microkernel in miniature (C = one 4 × 4 tile): pack (read → write, gather vs copy routes) → ldr + fmopa loop → st1w / stnt1w store, with the slices landing in memory; every value follows the four transpose states |
| `/strategy/sme-anatomy/` | The hardware vocabulary — a Z register, the ZA tile, and the compute unit, the three names every other page uses |
| `/strategy/roofline/` | Interactive roofline — peak compute and memory supply as the reader's own sliders; the ridge shows why arithmetic intensity, not raw FLOPs, decides what limits a kernel |
| `/strategy/memory-flow/` | A four-row timeline (Core / L1 / L2 / HBM) playing one kernel's store drain and the next kernel's prefetch across the cache hierarchy |
| `/quiz/` | Optional three-question linear-algebra self-check |
| `/quiz/matmul/` | The primer behind the self-check: matrix multiply as rows, columns, and dot products |

The FMOPA page draws a single-precision ZA tile at a streaming vector length of 128 bits, so the tile is 4×4. `z0.s` is the column operand (the first source is the SVL×1 vector), `z1.s` is the row operand, and each active pair does `ZA[i, j] += z0.s[i] × z1.s[j]`. LD1W walks contiguous words from memory into a Z register and zeroes inactive lanes; FMLA pairs two vectors lane by lane and merges; ST1W writes one W12-selected slice of ZA back to memory; WHILELT shows where predicates come from; UADDV collapses lanes into a 64-bit scalar; UZP1 shuffles whole vectors with no predicate at all.

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

Scalars `x0`, `x1`, `w11`, `w12` live in 64-bit general-purpose registers; gather indices in `z1.s` are 32-bit signed and scaled ×4 (`sxtw #2`).

Every instruction and kernel page shares the same interactions:

- Predicate bits are clickable. `/m` pages show inactive elements keeping their values; the `/z` page shows them reset to zero; ST1W's unqualified `p0` simply does not write the inactive elements; on the reduction page an inactive lane counts as zero. Several pages start with one bit already off, so that behavior shows on the first play.
- Play is a play/pause toggle, Replay restarts, and the arrow keys (or the ← → buttons) step one element at a time, backwards included. Space plays or pauses.
- Randomize re-rolls the operands.
- Each page adds only the inputs its instruction needs: ST1W a W12 slice selector, WHILELT steppers for the scalar bounds x0 and x1, FMLAL an index selector for `z1.h[idx]`, TBL clickable index lanes, the microkernel two layout selectors (M×K / K×M and K×N / N×K), FMOPA a Step-by-step / Parallel view switch, and the memory-flow page a C write-once / C accumulate mode switch.
- If the browser prefers reduced motion, Play jumps straight to the result.

The animation clock and control wiring live in `assets/js/player.js` and are shared by all animated pages; each page only draws its own stage.

## Strategy

The header nav follows the taxonomy — Instructions, Kernels, Strategy: each link lands on its section of the home page, and the section a page belongs to is marked current in the nav. The strategy pages: `/strategy/sme-anatomy/` — the hardware vocabulary (a register, the ZA tile, the compute unit) drawn once so the other pages can just use the names. `/strategy/roofline/` — an interactive roofline where peak compute and memory supply are the reader's own sliders, and the ridge between them shows why arithmetic intensity, not raw FLOPs, decides what limits a kernel. And `/strategy/memory-flow/` — a four-row timeline (Core / L1 / L2 / HBM) that plays one kernel's store drain and the next kernel's prefetch across the cache hierarchy. The page states its strategy first — three moves (prefetch ahead, never read what you overwrite, let the tail hide under the next kernel), each with its cost — and the timeline then makes each move checkable by eye: two-slot rails for transfers in flight, hit tags on the loads a prefetch served, and the one slot where HBM is asked for a read and a write at once (128 B against its 64 B budget).

Before the kernels, an optional pair warms up the linear algebra: `/quiz/` scores three questions on matrix shapes and dot products, and `/quiz/matmul/` is the primer it links to when the score needs it.

## Roadmap

Ideas for the next pages:

- A full kernel tour stitching whilelt → ld1w → fmopa → st1w into one played loop (the microkernel page already covers the kernel itself)
- Vertical broadcast, for example `addva za0.s, p0/m, p1/m, z0.s`
- Interleave back, for example `zip1 z0.s, z1.s, z2.s`

## Deploy

GitHub Pages publishes `main` automatically through `.github/workflows/pages.yml`, or any host that serves the repository root as static files can publish this as-is. Keep the directory layout: pages link to `assets/` with relative paths.
