/**
 * 命令层端到端：用假 ctx 跑 tap/status/verse/sound/board/board_remove/reset。
 * 不依赖真实宿主；重点盯输出协议、持久化、两段式确认与旧宿主回退。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { handleWoodfishCommand } from "../src/commands.js";

function makeCtx(overrides = {}) {
  const store = new Map();
  const calls = { actionCard: [], actionCardRemove: [], widgetCreate: [], confirm: [], toast: [] };
  const docked = new Set();
  const homeDock = (pageId, on) => {
    if (!pageId) return { ok: true, pageId: "", label: "", docked: [...docked], dockable: ["plugin:onethu.woodenfish:main"], entries: [] };
    if (on) docked.add(pageId);
    else docked.delete(pageId);
    return { ok: true, pageId, label: "电子木鱼", docked: [...docked], dockable: ["plugin:onethu.woodenfish:main"], entries: [] };
  };
  homeDock.set = homeDock;
  const ctx = {
    log() {},
    onethu: {
      storage: {
        get: (k) => (store.has(k) ? store.get(k) : null),
        set: (k, v) => store.set(k, v),
        keys: () => [...store.keys()],
        remove: (k) => store.delete(k),
      },
      ui: {
        confirm: async (...args) => {
          calls.confirm.push(args);
          return overrides.confirm !== false;
        },
        toast: (text) => calls.toast.push(text),
      },
      ext: {
        actionCard: async (input) => {
          calls.actionCard.push(input);
          return { id: `plugin-action:onethu.woodenfish:${input.cardId}`, boardId: input.boardId || "board.today", reused: Boolean(overrides.reused) };
        },
        actionCardRemove: async (cardId, boardId) => {
          calls.actionCardRemove.push({ cardId, boardId });
          return { ok: true };
        },
        homeDock,
        widgetCreate: (...args) => {
          calls.widgetCreate.push(args);
          return { id: "uw.static" };
        },
      },
    },
  };
  if (overrides.noActionCard) {
    delete ctx.onethu.ext.actionCard;
    delete ctx.onethu.ext.actionCardRemove;
  }
  if (overrides.noExt) ctx.onethu.ext = {};
  if (overrides.noDock) delete ctx.onethu.ext.homeDock;
  return { ctx, store, calls };
}

const deps = (ctx) => ({ ctx });

test("tap：默认 +1、可连敲、写进 storage", async () => {
  const { ctx, store } = makeCtx();
  const out = await handleWoodfishCommand(deps(ctx), "tap", "");
  assert.match(out, /功德 \+1/);
  assert.match(out, /累计 1/);
  assert.equal(store.get("merit.v1").total, 1);

  const ten = await handleWoodfishCommand(deps(ctx), "tap", "10");
  assert.match(ten, /连敲 10 下/);
  assert.equal(store.get("merit.v1").total, 11);
});

test("status / verse / sound", async () => {
  const { ctx, store } = makeCtx();
  await handleWoodfishCommand(deps(ctx), "tap", "7");

  const status = await handleWoodfishCommand(deps(ctx), "status", "");
  assert.match(status, /功德 7/);
  assert.match(status, /今日 \+7/);

  const verse = await handleWoodfishCommand(deps(ctx), "verse", "");
  assert.match(verse, /赛博真经：/);

  const off = await handleWoodfishCommand(deps(ctx), "sound", "");
  assert.match(off, /关闭/);
  assert.equal(store.get("merit.v1").sound, false);
  const on = await handleWoodfishCommand(deps(ctx), "sound", "");
  assert.match(on, /开启/);
});

test("board：调用宿主 actionCard 并带正确参数", async () => {
  const { ctx, calls } = makeCtx();
  const out = await handleWoodfishCommand(deps(ctx), "board", "");
  assert.match(out, /放到白板|已放到白板/);
  assert.equal(calls.actionCard.length, 1);
  const input = calls.actionCard[0];
  assert.equal(input.cardId, "main");
  assert.equal(input.tapCmdId, "tap");
  assert.equal(input.statusCmdId, "status");
  assert.equal(input.title, "电子木鱼");
  assert.ok(input.icon, "应有图标");
  assert.equal(input.boardId, undefined, "默认落首页");
});

test("board：指定 boardId 与已存在时提示更新", async () => {
  const { ctx, calls } = makeCtx({ reused: true });
  const out = await handleWoodfishCommand(deps(ctx), "board", "boardId=board.user.m1");
  assert.equal(calls.actionCard[0].boardId, "board.user.m1");
  assert.match(out, /更新/);
});

test("board：旧宿主优先停靠首页一级功能区", async () => {
  const { ctx } = makeCtx({ noActionCard: true });
  const out = await handleWoodfishCommand(deps(ctx), "board", "");
  assert.match(out, /首页一级功能区/);
  assert.ok(ctx.onethu.ext.homeDock().docked.includes("plugin:onethu.woodenfish:main"));
});

test("board：既无卡片也无 homeDock 时回退静态卡", async () => {
  const { ctx, calls } = makeCtx({ noActionCard: true, noDock: true });
  const out = await handleWoodfishCommand(deps(ctx), "board", "");
  assert.match(out, /静态卡|不支持可点击/);
  assert.equal(calls.widgetCreate.length, 1);
});

test("board：完全没有白板能力时给人话", async () => {
  const { ctx } = makeCtx({ noExt: true });
  const out = await handleWoodfishCommand(deps(ctx), "board", "");
  assert.match(out, /不支持白板卡片/);
});

test("board_remove", async () => {
  const { ctx, calls } = makeCtx();
  const out = await handleWoodfishCommand(deps(ctx), "board_remove", "");
  assert.match(out, /移除/);
  assert.equal(calls.actionCardRemove[0].cardId, "main");
});

test("dock / undock：停靠首页一级功能区", async () => {
  const { ctx, calls } = makeCtx();
  const on = await handleWoodfishCommand(deps(ctx), "dock", "");
  assert.match(on, /已加到首页|已停靠/);
  const state = ctx.onethu.ext.homeDock();
  assert.ok(state.docked.includes("plugin:onethu.woodenfish:main"));

  const off = await handleWoodfishCommand(deps(ctx), "undock", "");
  assert.match(off, /已从首页移除|未停靠/);
  assert.ok(!ctx.onethu.ext.homeDock().docked.includes("plugin:onethu.woodenfish:main"));
  assert.equal(calls.toast.length, 0);
});

test("dock：旧宿主没有 homeDock 时给人话", async () => {
  const { ctx } = makeCtx({ noDock: true });
  const out = await handleWoodfishCommand(deps(ctx), "dock", "");
  assert.match(out, /不支持首页一级功能区/);
});

test("reset：必须确认；取消则保留", async () => {
  const kept = makeCtx({ confirm: false });
  await handleWoodfishCommand(deps(kept.ctx), "tap", "3");
  const cancelled = await handleWoodfishCommand(deps(kept.ctx), "reset", "");
  assert.match(cancelled, /已取消/);
  assert.equal(kept.store.get("merit.v1").total, 3);

  const cleared = makeCtx({ confirm: true });
  await handleWoodfishCommand(deps(cleared.ctx), "tap", "3");
  const out = await handleWoodfishCommand(deps(cleared.ctx), "reset", "");
  assert.match(out, /已清空/);
  assert.equal(cleared.store.get("merit.v1").total, 0);
});

test("未知命令给人话", async () => {
  const { ctx } = makeCtx();
  const out = await handleWoodfishCommand(deps(ctx), "nope", "");
  assert.match(out, /未知命令/);
  assert.match(out, /tap\/status/);
});