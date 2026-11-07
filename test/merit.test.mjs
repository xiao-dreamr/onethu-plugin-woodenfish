/**
 * 功德账本纯逻辑测试：跨天归零、上限、坏数据回落、格式化。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  bumpMerit,
  formatMeritTotal,
  loadMeritState,
  meritDetailLine,
  meritStatusLine,
  normalizeMeritState,
  resetMeritState,
  saveMeritState,
  setSoundState,
} from "../src/merit.js";

const DAY1 = new Date(2026, 10, 7, 10, 0, 0); // 2026-11-07
const DAY2 = new Date(2026, 10, 8, 0, 1, 0); // 2026-11-08

test("默认状态", () => {
  const s = normalizeMeritState(null, DAY1);
  assert.equal(s.total, 0);
  assert.equal(s.todayCount, 0);
  assert.equal(s.today, "2026-11-07");
  assert.equal(s.sound, true);
});

test("敲击累加与跨天归零今日", () => {
  let s = bumpMerit(null, 1, DAY1);
  assert.equal(s.total, 1);
  assert.equal(s.todayCount, 1);
  s = bumpMerit(s, 5, DAY1);
  assert.equal(s.total, 6);
  assert.equal(s.todayCount, 6);

  const nextDay = bumpMerit(s, 1, DAY2);
  assert.equal(nextDay.total, 7);
  assert.equal(nextDay.todayCount, 1, "跨天 todayCount 归零后 +1");
  assert.equal(nextDay.today, "2026-11-08");
});

test("非法输入回落安全值", () => {
  const s = normalizeMeritState({ total: -5, todayCount: "x", today: 123, sound: "no" }, DAY1);
  assert.equal(s.total, 0);
  assert.equal(s.todayCount, 0);
  assert.equal(s.sound, true);

  const bumped = bumpMerit({ total: 3, today: "2026-11-07", todayCount: 2 }, 0, DAY1);
  assert.equal(bumped.total, 4, "n=0 归一为 1");
  const huge = bumpMerit({ total: 10, today: "2026-11-07", todayCount: 10 }, 1e9, DAY1);
  assert.ok(huge.total <= 999999999, "总量有上限");
});

test("格式化", () => {
  const s = normalizeMeritState({ total: 42, today: "2026-11-07", todayCount: 7 }, DAY1);
  assert.equal(formatMeritTotal(s), "42");
  assert.equal(meritStatusLine(s), "功德 42");
  assert.equal(meritDetailLine(s, DAY1), "今日 +7 · 累计 42");
});

function fakeCtx(store = new Map()) {
  return {
    onethu: {
      storage: {
        get: (k) => (store.has(k) ? store.get(k) : null),
        set: (k, v) => store.set(k, v),
        keys: () => [...store.keys()],
        remove: (k) => store.delete(k),
      },
    },
    store,
  };
}

test("持久化读写与重置", () => {
  const ctx = fakeCtx();
  assert.equal(loadMeritState(ctx).total, 0);
  saveMeritState(ctx, { total: 9, today: "2026-11-07", todayCount: 3, sound: false });
  const loaded = loadMeritState(ctx);
  assert.equal(loaded.total, 9);
  assert.equal(loaded.sound, false);

  const reset = resetMeritState(ctx);
  assert.equal(reset.total, 0);
  assert.equal(loadMeritState(ctx).total, 0);

  const soundOn = setSoundState(ctx, true);
  assert.equal(soundOn.sound, true);
});
