#!/usr/bin/env node
/* No-dependency checks for this static site:
   1. Every internal href/src in the HTML resolves to a file in the repo.
   2. Every i18n key used by HTML attributes or t("…") calls exists in STRINGS.
   3. Every key in STRINGS appears in both language packs (en and zh).
   Run from the repository root: node tools/check.mjs */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === ".video_agent") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

/* 1. Internal links resolve. */
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const refs = [...html.matchAll(/(?<![\w-])(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|data:|#)/.test(ref) || ref.startsWith("#")) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = resolve(dirname(file), clean.endsWith("/") ? join(clean, "index.html") : clean);
    if (!existsSync(target)) errors.push(`${file}: broken link "${ref}"`);
  }
}

/* CSS sanity: braces must balance and never close early. A dropped "}"
   silently swallows every later rule (it happened once — PR #14 repaired it). */
for (const file of files.filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(file, "utf8");
  let depth = 0;
  let line = 1;
  for (const ch of css) {
    if (ch === "\n") line++;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) {
        errors.push(`${file}:${line}: stray closing brace`);
        break;
      }
    }
  }
  if (depth > 0) {
    errors.push(`${file}: ${depth} unclosed block(s) at end of file (rules after the break will not apply)`);
  }
}

/* .wasm artifacts must stay valid WebAssembly binaries — a truncated or
   text-edited file would only fail at fetch/instantiate time in a browser. */
for (const file of files.filter((f) => f.endsWith(".wasm"))) {
  const bytes = readFileSync(file);
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x00 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6d
  ) {
    errors.push(`${file}: missing \\0asm magic — not a WebAssembly binary`);
  }
}

/* 2. and 3. i18n keys. */
const i18nSource = readFileSync(join(root, "assets/js/i18n.js"), "utf8");
const defined = new Map(); // key -> occurrence count in STRINGS
for (const m of i18nSource.matchAll(/"([A-Za-z0-9._-]+)":\s*"/g)) {
  defined.set(m[1], (defined.get(m[1]) || 0) + 1);
}

const used = new Set();
const attrRe = /data-i18n(?:-aria|-content)?="([^"]+)"/g;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(attrRe)) used.add(m[1]);
}
for (const file of files.filter((f) => f.endsWith(".js") && !f.endsWith("i18n.js"))) {
  const js = readFileSync(file, "utf8");
  /* Any dotted string literal is treated as an i18n key reference, which also
     catches t(cond ? "keyA" : "keyB") ternaries. */
  for (const m of js.matchAll(/"([A-Za-z0-9]+(?:\.[A-Za-z0-9._-]+)+)"/g)) used.add(m[1]);
}

for (const key of used) {
  if (!defined.has(key)) errors.push(`i18n key used but not defined: "${key}"`);
}
for (const [key, count] of defined) {
  if (count !== 2) errors.push(`i18n key "${key}" occurs ${count} time(s); expected 2 (en + zh)`);
  if (!used.has(key) && key !== "site-lang") warnings.push(`i18n key defined but unused: "${key}"`);
}

for (const warning of warnings) console.warn(`warn: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exit(1);
}
console.log(`ok: ${htmlFiles.length} html file(s), ${used.size} i18n key(s) used, ${defined.size} defined, links resolve`);
