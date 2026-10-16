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

The FMOPA page draws a single-precision ZA tile at a streaming vector length of 128 bits, so the tile is 4×4. `z0.s` is the column operand, `z1.s` is the row operand, and each active pair does `ZA[i, j] += z0.s[i] × z1.s[j]`. LD1W walks contiguous words from memory into a Z register and zeroes inactive lanes; FMLA pairs two vectors lane by lane and merges; ST1W writes one W12-selected slice of ZA back to memory. Together they cover the `/m` merge, `/z` zeroing, and bare-predicate forms.

Every demo page shares the same interactions:

- Predicate bits are clickable. `/m` pages show inactive elements keeping their values; the `/z` page shows them reset to zero.
- Play is a play/pause toggle, Replay restarts, and the arrow keys (or the ← → buttons) step one element at a time, backwards included. Space plays or pauses.
- Randomize re-rolls the operands. The ST1W page adds a W12 selector for the slice to store.
- If the browser prefers reduced motion, Play jumps straight to the result.

The animation clock and control wiring live in `assets/js/player.js` and are shared by all demos; each demo only draws its own stage.

## Roadmap

Ideas for the next pages:

- Predicate setup, for example `whilelt p0.s, x0, x1`
- Deinterleaving, for example `uzp1 z0.s, z1.s, z2.s`
- Horizontal reduction, for example `addv d0, p0/m, z0.s`
- Widening multiply-accumulate, for example `fmlal za.s[w11, 0], z0.h, z1.h[2]`

## Deploy

GitHub Pages publishes `main` automatically through `.github/workflows/pages.yml`, or any host that serves the repository root as static files can publish this as-is. Keep the directory layout: pages link to `assets/` with relative paths.
