# simd-anim

A static lab for interactive animations of ARM SIMD and SME instructions. Each page plays one real instruction so you can watch values move through Z registers, predicates, and ZA tiles.

English is the default. The EN / 中文 control on every page stores the choice in `localStorage` under `site-lang`.

## Run locally

Open `index.html` in a browser, or serve the repository root so the demo path resolves the same way it will on a static host:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080/>.

No build step. The site is plain HTML, CSS, and JavaScript.

## Pages

| Path | What it shows |
| --- | --- |
| `/` | What this lab is, and the list of demos |
| `/demos/fmopa/` | SME outer product `fmopa za.s[w11, 0], p0/m, p1/m, z0.s, z1.s` |

The FMOPA page draws a single-precision ZA tile at a streaming vector length of 128 bits, so the tile is 4×4. `z0.s` is the column operand, `z1.s` is the row operand, and each active pair does `ZA[i, j] += z0.s[i] × z1.s[j]`. Play and Replay run that instruction from the same starting tile. If the browser prefers reduced motion, Play jumps straight to the result.

## Roadmap

More pages will follow. Next demos:

- Vector load / pack, for example `ld1w { z0.s }, p0/z, [x0]`
- FMLA, for example `fmla z0.s, p0/m, z1.s, z2.s`
- Store of a ZA slice, for example `st1w { za0h.s[w12, 0] }, p0, [x0]`

## Deploy

GitHub Pages, or any host that serves the repository root as static files, can publish this as-is. Keep the directory layout: pages link to `assets/` with relative paths.
