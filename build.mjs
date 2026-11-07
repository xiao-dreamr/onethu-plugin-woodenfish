#!/usr/bin/env node
/**
 * woodenfish 单文件构建器（零依赖，规则与 plugins/pdf4oh/build.mjs 相同）。
 *
 * OneTHU 的 JS 插件安装形态是「一段 ES 模块文本」，不能相对 import / 引 npm 包。
 * 开发时把逻辑拆成模块，发布时按固定顺序拼接成 plugin.js：
 *   - 只允许单行或跨行的具名 import（import { a, b } from "./x.js"）；
 *   - 只允许具名 export（export function/const/class），禁止 export default；
 *   - 顶层声明名全局唯一（本脚本静态检查）；
 *   - 跨模块调用只发生在函数体/activate 内（拼接后顺序执行）。
 *
 * 用法：
 *   node plugins/woodenfish/build.mjs
 *   node plugins/woodenfish/build.mjs --check
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULES = [
  "src/verses.js",
  "src/merit.js",
  "src/sound.js",
  "src/page.js",
  "src/actions.js",
  "src/card.js",
  "src/commands.js",
  "src/tab.js",
  "src/index.js",
];
const OUT = "plugin.js";
const DECL_RE = /^(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_BRACE_RE = /^export\s*\{[^}]*\};?\s*$/;
const EXPORT_DECL_RE = /^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/;

function fail(message) {
  console.error(`[build] ${message}`);
  process.exit(1);
}

function stripModule(source, file) {
  const lines = source.split(/\r?\n/);
  const out = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    if (/^import\b/.test(trimmed)) {
      let block = trimmed;
      while (!/from\s+"[^"]+";?\s*$/.test(block) && li + 1 < lines.length) {
        li++;
        block += " " + lines[li].trim();
      }
      const m = /^import\s+\{([\s\S]*?)\}\s+from\s+"([^"]+)"\s*;?$/.exec(block);
      if (!m) fail(`${file}: 只允许具名 import（import { a, b } from "./x.js"）`);
      if (/\bas\b/.test(m[1])) fail(`${file}: 禁止 import 重命名（as）`);
      continue;
    }
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (EXPORT_BRACE_RE.test(trimmed)) continue;
    if (/^export\s+default\b/.test(trimmed)) fail(`${file}: 禁止 export default（manifest/activate 由构建尾部导出）`);
    if (/\bimport\s*\(/.test(trimmed)) fail(`${file}: 禁止动态 import()`);
    if (/\brequire\s*\(/.test(trimmed)) fail(`${file}: 禁止 require()`);
    out.push(EXPORT_DECL_RE.test(trimmed) ? line.replace(EXPORT_DECL_RE, "") : line);
  }
  return out.join("\n").replace(/^\s+|\s+$/g, "");
}

function collectDeclarations(source, file, seen) {
  for (const line of source.split(/\r?\n/)) {
    if (/^\s/.test(line)) continue;
    const m = DECL_RE.exec(line.trim());
    if (!m) continue;
    const name = m[1];
    if (seen.has(name)) fail(`顶层声明重名：${name}（${seen.get(name)} 与 ${file}）`);
    seen.set(name, file);
  }
}

function build() {
  const seen = new Map();
  const parts = [];
  for (const mod of MODULES) {
    const abs = join(ROOT, mod);
    if (!existsSync(abs)) fail(`缺少模块文件：${mod}`);
    const body = stripModule(readFileSync(abs, "utf8"), mod);
    collectDeclarations(body, mod, seen);
    parts.push(`/* ═══════════ ${mod} ═══════════ */\n${body}`);
  }
  for (const required of ["manifest", "activate"]) {
    if (!seen.has(required)) fail(`构建产物缺少必需的顶层声明：${required}`);
  }
  const banner = [
    "/**",
    " * woodenfish — OneTHU 电子木鱼插件（单文件构建产物）",
    " *",
    " * 本文件由 plugins/woodenfish/build.mjs 从 src/ 生成，请勿手改。",
    " * 玩法：敲电子木鱼，取赛博真经。插件页可敲、白板交互卡片可敲，功德本地累计。",
    " */",
  ].join("\n");
  return `${banner}\n\n${parts.join("\n\n")}\n\nexport { manifest };\nexport default activate;\n`;
}

const next = build();
const outPath = join(ROOT, OUT);
if (process.argv.includes("--check")) {
  if (!existsSync(outPath)) fail(`${OUT} 不存在：先运行 node plugins/woodenfish/build.mjs`);
  if (readFileSync(outPath, "utf8") !== next) fail(`${OUT} 与 src/ 不同步：运行 node plugins/woodenfish/build.mjs 重新生成`);
  console.log(`[build] ${OUT} 与源码同步（${next.length} bytes）`);
} else {
  writeFileSync(outPath, next);
  console.log(`[build] 已生成 ${relative(process.cwd(), outPath)}（${next.length} bytes，${MODULES.length} 个模块）`);
}
