/**
 * 敲击动作（命令层与插件页共用）：一次敲击 = 记一笔功德 +（按设置）发声。
 *
 * 为什么单独一层：白板卡片的点击回调、插件页的点击、OH 的 run_plugin_cmd 都走
 * 同一段逻辑，避免三处各写一遍导致「卡片和页面加的数不一样」。
 */

import { bumpMerit, loadMeritState, meritStatusLine, resetMeritState, saveMeritState, setSoundState } from "./merit.js";
import { playWoodfish } from "./sound.js";

const WOODFISH_TAP_MIN = 1;
const WOODFISH_TAP_MAX = 999;

/** 把任意输入解析成合法敲击次数（1–999；非法回 1）。 */
export function parseTapCount(raw) {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(WOODFISH_TAP_MAX, Math.max(WOODFISH_TAP_MIN, n));
}

/**
 * 敲一下（或 n 下）。同步完成记账，返回值是敲完后的状态。
 * @param {object} ctx 插件上下文
 * @param {number} count 1–999
 * @param {{silent?: boolean}} [opts] silent = 不发声（自动连敲/静音场景）
 */
export function performTap(ctx, count = 1, opts = {}) {
  const step = parseTapCount(count);
  const state = saveMeritState(ctx, bumpMerit(loadMeritState(ctx), step));
  if (state.sound && opts.silent !== true) playWoodfish(1);
  return state;
}

/** 开关音效；打开时立即试响一声，让用户确认。 */
export function toggleWoodfishSound(ctx) {
  const current = loadMeritState(ctx);
  const state = setSoundState(ctx, !current.sound);
  if (state.sound) playWoodfish(0.65);
  return state;
}

/** 清空功德（调用方负责先确认）。 */
export function resetWoodfishMerit(ctx) {
  return resetMeritState(ctx);
}

/** 卡片左上角/命令状态行：只显示总量。 */
export function woodfishStatus(ctx) {
  return meritStatusLine(loadMeritState(ctx));
}