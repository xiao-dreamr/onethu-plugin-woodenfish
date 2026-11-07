/**
 * 构建产物守门 + 激活冒烟（针对用户实际安装的 plugin.js）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLUGIN_JS = join(ROOT, "plugin.js");
const MANIFEST_JSON = join(ROOT, "manifest.json");
const ALLOWED_PERMISSIONS = new Set(["ui", "storage", "css"]);

function fakeCtx(commands, tabs, css, store = new Map()) {
  return {
    log() {},
    registerCommand(cmd, run) {
      commands.push({ cmd, run });
    },
    registerTab(tab) {
      tabs.push(tab);
    },
    registerCss(text) {
      css.push(text);
    },
    onethu: {
      storage: {
        get: (k) => (store.has(k) ? store.get(k) : null),
        set: (k, v) => store.set(k, v),
        keys: () => [...store.keys()],
        remove: (k) => store.delete(k),
      },
      ui: {
        onTabReady: () => () => {},
        toast() {},
        confirm: async () => true,
      },
      ext: {
        homeDock: Object.assign(
          (pageId, on) => ({ ok: true, pageId: pageId ?? "", label: "", docked: on ? [pageId] : [], dockable: [], entries: [] }),
          { set: (pageId, on) => ({ ok: true, pageId, label: "", docked: on ? [pageId] : [], dockable: [], entries: [] }) },
        ),
      },
    },
  };
}

test("build.mjs --check：plugin.js 与 src 同步", () => {
  const r = spawnSync(process.execPath, [join(ROOT, "build.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, `构建产物不同步：\n${r.stdout}\n${r.stderr}`);
});

test("plugin.js 是自包含 ES 模块", () => {
  assert.ok(existsSync(PLUGIN_JS), "plugin.js 不存在：先运行 node plugins/woodenfish/build.mjs");
  const code = readFileSync(PLUGIN_JS, "utf8");
  assert.ok(code.length > 5000, "plugin.js 太小");
  assert.ok(code.length < 200 * 1024, "plugin.js 过大");
  assert.doesNotMatch(code, /(^|[^.\w])import\s*\(/m, "不得有动态 import()");
  assert.doesNotMatch(code, /\brequire\s*\(/, "不得 require()");
  assert.doesNotMatch(code, /^\s*import\s+/m, "单文件产物不得有 ESM import");
  assert.match(code, /export\s*\{\s*manifest\s*\}/);
  assert.match(code, /export\s+default\s+activate/);
});

test("manifest 与 manifest.json 一致，权限最小", async () => {
  const mod = await import(pathToFileURL(PLUGIN_JS).href);
  const disk = JSON.parse(readFileSync(MANIFEST_JSON, "utf8"));
  assert.deepEqual(mod.manifest, disk);
  assert.equal(mod.manifest.id, "onethu.woodenfish");
  assert.ok(mod.manifest.entry === "plugin.js");
  for (const p of mod.manifest.permissions) assert.ok(ALLOWED_PERMISSIONS.has(p), `多余权限：${p}`);
  for (const required of ["ui", "storage"]) assert.ok(mod.manifest.permissions.includes(required), `缺权限：${required}`);
});

test("activate：注册七个命令 + 功能页 + 样式，dispose 可调用", async () => {
  const mod = await import(pathToFileURL(PLUGIN_JS).href);
  const commands = [];
  const tabs = [];
  const css = [];
  const disposable = await mod.default(fakeCtx(commands, tabs, css));
  assert.deepEqual(
    commands.map((row) => row.cmd.id).sort(),
    ["board", "board_remove", "dock", "reset", "sound", "status", "tap", "undock", "verse"],
  );
  for (const row of commands) assert.ok(row.cmd.title && row.cmd.title.length >= 6, `${row.cmd.id} title 太短`);
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].title, "电子木鱼");
  assert.ok(css.length >= 1);
  assert.match(css[0], /\[data-plg="onethu\.woodenfish"\]/);
  assert.equal(typeof disposable.dispose, "function");
  disposable.dispose();
});

test("从 plugin.js 跑 tap：功德真的 +1 且返回状态行", async () => {
  const mod = await import(pathToFileURL(PLUGIN_JS).href);
  const commands = [];
  const store = new Map();
  await mod.default(fakeCtx(commands, [], [], store));
  const tap = commands.find((row) => row.cmd.id === "tap");
  const first = await tap.run("");
  assert.match(first, /功德 \+1/);
  assert.equal(store.get("merit.v1").total, 1);
  const second = await tap.run("2");
  assert.match(second, /累计 3/);
});