/* The site bench engine, shared by the homepage (extras.js wires the buttons
   and the terminal) and the lab's roofline page (which measures in place).
   Two tiers, both honestly labelled wherever they are shown:

     scalar — FP64 JavaScript, 4×4 register blocking, swept across five
              matrix sizes. Small sizes sit in cache; once the working set
              outgrows it the numbers sag. That sag is the capacity wall,
              measured live in the visitor's own browser.
     simd   — FP32 through WebAssembly simd128, four lanes at a time: the
              browser's own z0.s. The kernel is the same 4-row i-block as the
              scalar one (see tools/bench_simd.wat); FP32 halves the bytes,
              so its points sit at twice the arithmetic intensity.

   Results ride in localStorage under "site-bench" (v2), expire in a week —
   the numbers describe the device that ran them, not this browser forever —
   and dispatch "site-bench-progress" per measured point plus "site-bench"
   once everything is in. */
(function () {
  "use strict";

  var M4_PCORE_FP64 = 35; // GFLOPS: 4 SIMD pipes x 2 FP64 lanes x ~4.4 GHz
  var HEADLINE_N = 384;

  /* Scalar sweep sizes. A roofline point for size N sits at the naive GEMM
     intensity N/12 FLOP/byte (2N³ FLOP over 3N²·8B); 48…768 land the points
     on the chart's power-of-two grid at 4…64. */
  var SWEEP_N = [48, 96, 192, 384, 768];
  var REPS_HEADLINE = 3;
  var REPS_DEFAULT = 2;
  var EST_CAP_MS = 700; /* skip a size whose single rep is estimated longer */
  var SIZE_BUDGET_MS = 450; /* extra reps only while this budget holds */

  /* SIMD sizes, FP32: N/6 naive intensity puts 192→32 and 384→64. */
  var SIMD_SIZES = [192, 384];
  var SIMD_TOL = 1e-3;
  var WASM_PAGES = 64; /* 4 MB ≥ the 1.8 MB of three 384×384 FP32 matrices */

  var STORE_KEY = "site-bench";
  var STORE_TTL = 7 * 24 * 60 * 60 * 1000;

  function fillRandom(a) {
    for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }

  function gemm(n, A, B, C) {
    // 4x4 register blocking, i-k-j: four B values feed sixteen FMAs, the C
    // tile stays hot, and the sixteen chains keep the pipes busy in a JIT.
    for (var i = 0; i < n - 3; i += 4) {
      var c0 = i * n, c1 = c0 + n, c2 = c1 + n, c3 = c2 + n;
      for (var k = 0; k < n; k++) {
        var a0 = A[c0 + k], a1 = A[c1 + k], a2 = A[c2 + k], a3 = A[c3 + k];
        var bo = k * n;
        var j = 0;
        for (; j + 3 < n; j += 4) {
          var b0 = B[bo + j], b1 = B[bo + j + 1], b2 = B[bo + j + 2], b3 = B[bo + j + 3];
          C[c0 + j] += a0 * b0; C[c0 + j + 1] += a0 * b1; C[c0 + j + 2] += a0 * b2; C[c0 + j + 3] += a0 * b3;
          C[c1 + j] += a1 * b0; C[c1 + j + 1] += a1 * b1; C[c1 + j + 2] += a1 * b2; C[c1 + j + 3] += a1 * b3;
          C[c2 + j] += a2 * b0; C[c2 + j + 1] += a2 * b1; C[c2 + j + 2] += a2 * b2; C[c2 + j + 3] += a2 * b3;
          C[c3 + j] += a3 * b0; C[c3 + j + 1] += a3 * b1; C[c3 + j + 2] += a3 * b2; C[c3 + j + 3] += a3 * b3;
        }
        for (; j < n; j++) {
          var b = B[bo + j];
          C[c0 + j] += a0 * b; C[c1 + j] += a1 * b; C[c2 + j] += a2 * b; C[c3 + j] += a3 * b;
        }
      }
    }
  }

  /* One timed GEMM rep. C is zeroed inside so reps stay comparable. */
  function runGemm(n, A, B, C) {
    C.fill(0);
    var start = performance.now();
    gemm(n, A, B, C);
    var ms = performance.now() - start;
    return { ms: ms, gflops: (2 * n * n * n) / (ms / 1000) / 1e9 };
  }

  function checkDot(n, A, B, C) {
    var ref = 0;
    for (var k = 0; k < n; k++) ref += A[k] * B[17 + k * n];
    return Math.abs(C[17] - ref) <= 1e-8 * (1 + Math.abs(ref));
  }

  function tick(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 30); });
  }

  /* Each measured point reaches listeners two ways: the callback the caller
     passed (buttons, the roofline status line) and a document event (the
     terminal narrates through this one). */
  function report(progress, detail) {
    if (progress) progress(detail);
    document.dispatchEvent(new CustomEvent("site-bench-progress", { detail: detail }));
  }

  /* ---------- scalar FP64 sweep ---------- */

  function runScalarSweep(progress) {
    /* JIT warmup at 96, untimed — same as the bench has always done. */
    var w = 96;
    var wA = new Float64Array(w * w), wB = new Float64Array(w * w), wC = new Float64Array(w * w);
    fillRandom(wA);
    fillRandom(wB);
    runGemm(w, wA, wB, wC);

    var points = [];
    var headlineOk = false;
    var prevMs = null;
    var prevN = 0;
    var chain = Promise.resolve();

    SWEEP_N.forEach(function (n) {
      chain = chain.then(function () {
        var A = new Float64Array(n * n), B = new Float64Array(n * n), C = new Float64Array(n * n);
        fillRandom(A);
        fillRandom(B);
        var reps = n === HEADLINE_N ? REPS_HEADLINE : REPS_DEFAULT;
        if (prevMs != null) {
          /* a GEMM rep scales cubically with n; skip sizes this device
             cannot afford and trim the rep count to the time budget */
          var est = prevMs * Math.pow(n / prevN, 3);
          if (est > EST_CAP_MS) {
            report(progress, { kind: "scalar", n: n, skipped: true });
            return;
          }
          reps = Math.max(1, Math.min(reps, Math.floor(SIZE_BUDGET_MS / Math.max(est, 1)) + 1));
        }
        var best = 0;
        var bestMs = 0;
        var inner = Promise.resolve();
        for (var s = 0; s < reps; s++) {
          inner = inner.then(tick).then(function () {
            var r = runGemm(n, A, B, C);
            if (r.gflops > best) { best = r.gflops; bestMs = r.ms; }
          });
        }
        return inner.then(function () {
          prevMs = bestMs;
          prevN = n;
          points.push({ n: n, gflops: best });
          if (n === HEADLINE_N) headlineOk = checkDot(n, A, B, C);
          report(progress, { kind: "scalar", n: n, gflops: best });
        });
      });
    });

    return chain.then(function () { return { points: points, headlineOk: headlineOk }; });
  }

  /* ---------- WASM SIMD tier (FP32, f32x4) ---------- */

  var simdInst = null;

  /* Resolved once at script load. document.currentScript proved unreliable
     here, so find this file's own <script> tag — it is already in the DOM
     while the file executes — and resolve the .wasm next to it. Resolving
     later (from a click) would land the relative URL on the calling page,
     which breaks every page outside the repository root. */
  var WASM_URL = (function () {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src;
      if (src && /bench-core\.js$/.test(src)) return new URL("bench-simd.wasm", src).href;
    }
    return "bench-simd.wasm";
  })();

  function loadSimd() {
    if (typeof WebAssembly === "undefined") return Promise.resolve(null);
    if (simdInst) return Promise.resolve(simdInst);
    var mem = new WebAssembly.Memory({ initial: WASM_PAGES });
    return fetch(WASM_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.arrayBuffer();
      })
      .then(function (bytes) {
        return WebAssembly.instantiate(bytes, { env: { mem: mem } });
      })
      .then(function (pair) {
        var exp = pair.instance && pair.instance.exports;
        if (!exp || typeof exp.gemm_f32 !== "function") return null;
        simdInst = { exports: exp, mem: mem };
        return simdInst;
      })
      .catch(function () {
        return null;
      });
  }

  function runSimdSweep(progress) {
    return loadSimd().then(function (sim) {
      if (!sim) {
        report(progress, { kind: "simd", unsupported: true });
        return { ok: false, points: [] };
      }
      var gemmSimd = sim.exports.gemm_f32;
      var maxN = SIMD_SIZES[SIMD_SIZES.length - 1];
      var maxCount = maxN * maxN;
      /* one absolute layout for every size: A at 0, B at maxN², C at 2·maxN².
         A size-n run reads the leading n×n square of each fill; the FP64
         reference below reads the same bytes, so the numbers stay honest. */
      var f = new Float32Array(sim.mem.buffer);
      for (var i = 0; i < 2 * maxCount; i++) f[i] = Math.random() * 2 - 1;

      var points = [];
      var ok = true;
      var chain = Promise.resolve();

      SIMD_SIZES.forEach(function (n) {
        chain = chain.then(function () {
          var c0 = 2 * maxCount;
          var best = 0;
          var inner = tick().then(function () { gemmSimd(n, 0, maxCount * 4, c0 * 4); });
          for (var s = 0; s < 2; s++) {
            inner = inner.then(tick).then(function () {
              f.fill(0, c0, c0 + maxCount);
              var t0 = performance.now();
              gemmSimd(n, 0, maxCount * 4, c0 * 4);
              var ms = performance.now() - t0;
              var g = (2 * n * n * n) / (ms / 1000) / 1e9;
              if (g > best) best = g;
            });
          }
          return inner.then(function () {
            var worst = 0;
            [[0, Math.min(17, n - 1)], [n - 1, n - 1]].forEach(function (rc) {
              var ref = 0;
              for (var k = 0; k < n; k++) ref += f[rc[0] * n + k] * f[maxCount + rc[1] + k * n];
              var got = f[c0 + rc[0] * n + rc[1]];
              worst = Math.max(worst, Math.abs(got - ref) / (1 + Math.abs(ref)));
            });
            if (worst > SIMD_TOL) ok = false;
            points.push({ n: n, gflops: best });
            report(progress, { kind: "simd", n: n, gflops: best });
          });
        });
      });

      return chain.then(function () { return { ok: ok, points: points }; });
    });
  }

  /* ---------- the whole suite ---------- */

  function runBench(progress) {
    return runScalarSweep(progress).then(function (sweep) {
      var scalar = sweep.points;
      var head = null;
      scalar.forEach(function (p) {
        if (p.n === HEADLINE_N) head = p;
      });
      if (!head && scalar.length) head = scalar[scalar.length - 1];
      return runSimdSweep(progress).then(function (simd) {
        var res = {
          v: 2,
          gflops: head ? head.gflops : 0,
          ok: sweep.headlineOk && !!head,
          ts: Date.now(),
          scalar: scalar,
          simd: simd
        };
        benchLast = res;
        saveBench(res);
        document.dispatchEvent(new CustomEvent("site-bench", { detail: res }));
        return res;
      });
    });
  }

  /* ---------- storage ---------- */

  function saveBench(res) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 2,
        gflops: res.gflops,
        ok: res.ok,
        ts: res.ts,
        scalar: res.scalar,
        simd: res.simd
      }));
    } catch (error) {}
  }

  /* The single reader for the stored bench. v1 entries (one scalar number,
     no sweep) come back as a one-point sweep so every consumer can work in
     v2 terms; null means no fresh result for this device. */
  function readStored() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!raw || !raw.ts || Date.now() - raw.ts > STORE_TTL) return null;
      if (raw.v === 2 && typeof raw.gflops === "number" && raw.gflops > 0 && Array.isArray(raw.scalar)) {
        return raw;
      }
      if (raw.v === 1 && typeof raw.gflops === "number" && raw.gflops > 0 && typeof raw.ok === "boolean") {
        return {
          v: 2,
          gflops: raw.gflops,
          ok: raw.ok,
          ts: raw.ts,
          scalar: [{ n: HEADLINE_N, gflops: raw.gflops }],
          simd: null
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  var benchLast = readStored();

  /* the kernel zoo (zoo.js) reads the last bench result for its captions */
  window.siteBench = {
    run: runBench,
    last: function () { return benchLast; },
    readStored: readStored,
    M4: M4_PCORE_FP64,
    headlineN: HEADLINE_N
  };
})();
