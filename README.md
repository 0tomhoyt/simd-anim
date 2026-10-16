# simd-anim

[![CI and Pages](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml/badge.svg)](https://github.com/0tomhoyt/simd-anim/actions/workflows/pages.yml)

A static lab for interactive animations of ARM SIMD and SME instructions. Each page plays one real instruction so you can watch values move through Z registers, predicates, and ZA tiles.

English is the default. The EN / 中文 control on every page stores the choice in `localStorage` under `site-lang`; a first visit without a stored choice follows the browser language.

## Run locally

Open `index.html` in a browser, or serve the repository root so the demo path resolves the same way it will on a static host:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080/>. No build step. The site is plain HTML, CSS, and JavaScript.

`node tools/check.mjs` verifies internal links and the bilingual string table; CI runs the same check and publishes `main` to GitHub Pages on every push.

## Pages

| Path | What it shows |
| --- | --- |
| `/` | What this lab is, and the list of demos |
| `/demos/fmopa/` | SME outer product `fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s` |
| `/demos/ld1w/` | SVE predicated load `ld1w { z0.s }, p0/z, [x0]` — `/z` zeroing |
| `/demos/fmla/` | SVE fused multiply-add `fmla z0.s, p0/m, z1.s, z2.s` — `/m` merging |
| `/demos/st1w/` | SME slice store `st1w { za0h.s[w12, 0] }, p0, [x0]` — W12 picks the slice |
| `/demos/whilelt/` | SVE predicate setup `whilelt p0.s, x0, x1` — scalar bounds become bits, with live x0/x1 steppers |
| `/demos/addv/` | SVE reduction `addv d0, p0/m, z0.s` — active lanes collapse into one scalar |
| `/demos/uzp1/` | SVE deinterleave `uzp1 z0.s, z1.s, z2.s` — even elements of two vectors gather into one |
| `/demos/gather/` | SVE gather load `ld1w { z0.s }, p0/z, [x0, z1.s, sxtw #2]` — each lane reads the word its own index selects |
| `/demos/microkernel/` | A real GEMM microkernel (scaled to SVL = 128): pack → K loop (ldr + fmopa ×4 + prefetch) → st1w / stnt1w store, animated across all four transpose states |
| `/demos/fmlal/` | SME2 widening multiply-add `fmlal za.s[w11, 4:5], z0.h, z1.h[2]` — half in, single out |
| `/demos/addha/` | SME broadcast add `addha za0.s, p0/m, p1/m, z0.s` — one vector into every active row |
| `/demos/tbl/` | SVE table lookup `tbl z0.s, { z1.s, z2.s }, z3.s` — any element, out of range gives zero |
| `/concepts/` | Concept pages — the machine-level ideas behind the demos |

The FMOPA page draws a single-precision ZA tile at a streaming vector length of 128 bits, so the tile is 4×4. `z0.s` is the column operand, `z1.s` is the row operand, and each active pair does `ZA[i, j] += z0.s[i] × z1.s[j]`. LD1W walks contiguous words from memory into a Z register and zeroes inactive lanes; FMLA pairs two vectors lane by lane and merges; ST1W writes one W12-selected slice of ZA back to memory; WHILELT shows where predicates come from; ADDV collapses lanes into a scalar; UZP1 shuffles whole vectors with no predicate at all.

## Sizes and types

Every page draws one streaming vector length — SVL = 128 bits — and each page carries a note under the instruction naming the data types it shows. The arithmetic is uniform, so the same drawings scale cleanly to wider hardware:

| Quantity | SVL 128 (drawn) | SVL 512 |
| --- | --- | --- |
| `.s` lanes per Z register | 4 × 32-bit float | 16 |
| Predicate bits (`p0.s`, `whilelt` output) | 4 | 16 |
| FMOPA / ZA `.s` tile | 4 × 4 | 16 × 16 |
| `st1w` slice selector `w12` | 0…3 | 0…15 |
| Contiguous load/store window | 16 bytes | 64 bytes |
| `addv` destination `d0` | 64-bit scalar | 64-bit scalar |
| `fmlal` half-precision operands | 8 × 16-bit | 32 × 16-bit |
| `tbl` two-register table entries | 8 | 32 |

Scalars `x0`, `x1`, `w11`, `w12` live in 64-bit general-purpose registers; gather indices in `z1.s` are 32-bit signed and scaled ×4 (`sxtw #2`).

Every demo page shares the same interactions:

- Predicate bits are clickable. `/m` pages show inactive elements keeping their values; the `/z` page shows them reset to zero. Several pages start with one bit already off, so that behavior shows on the first play.
- Play is a play/pause toggle, Replay restarts, and the arrow keys (or the ← → buttons) step one element at a time, backwards included. Space plays or pauses.
- Randomize re-rolls the operands. The ST1W page adds a W12 selector for the slice to store.
- If the browser prefers reduced motion, Play jumps straight to the result.

The animation clock and control wiring live in `assets/js/player.js` and are shared by all demos; each demo only draws its own stage.

## Concepts

The header nav carries a second track: `/concepts/` lists concept pages, reached from any page by the top navigation. The first is `/concepts/roofline/` — an interactive roofline where peak compute and memory supply are the reader's own sliders, and the ridge between them shows why arithmetic intensity, not raw FLOPs, decides what limits a kernel. No machine-specific numbers.

## Roadmap

Ideas for the next pages:

- A full kernel tour stitching whilelt → ld1w → fmopa → st1w into one played loop (the microkernel page already covers the kernel itself)
- Vertical broadcast, for example `addva za0.s, p0/m, p1/m, z0.s`
- Interleave back, for example `zip1 z0.s, z1.s, z2.s`

## Deploy

GitHub Pages publishes `main` automatically through `.github/workflows/pages.yml`, or any host that serves the repository root as static files can publish this as-is. Keep the directory layout: pages link to `assets/` with relative paths.
