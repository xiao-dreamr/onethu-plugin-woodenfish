/**
 * 功德账本（纯逻辑 + 本地持久化）。
 *
 * 为什么要单独成模块：功德是插件唯一的状态，读写必须可测、可回滚、坏数据不能炸。
 *   - 只存本机 `ctx.onethu.storage`（插件私有命名空间），不联网、不上传；
 *   - 结构 { total, today, todayCount, sound }：today 是本地日期（YYYY-MM-DD），
 *     跨天第一次敲时把 todayCount 归零（total 不清）；
 *   - 输入全部做归一化：负数/NaN/超大整数/非对象存储值都回落到安全值；
 *   - 纯函数（bumpMerit / normalizeMeritState / format*）不碰 ctx，便于 node 测试。
 */

const MERIT_KEY = "merit.v1";
const MERIT_STEP_MAX = 999;
const MERIT_TOTAL_MAX = 999999999;

export function meritToday(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeInt(value, fallback, min, max) {
  const n = typeof value === "number" ? Math.trunc(value) : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 存储值 → 合法状态（任何坏输入都回落到默认，不抛错）。 */
export function normalizeMeritState(raw, now = new Date()) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const today = meritToday(now);
  const storedDay = typeof obj.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.today) ? obj.today : "";
  const sameDay = storedDay === today;
  return {
    total: safeInt(obj.total, 0, 0, MERIT_TOTAL_MAX),
    today,
    todayCount: sameDay ? safeInt(obj.todayCount, 0, 0, MERIT_TOTAL_MAX) : 0,
    sound: obj.sound !== false,
  };
}

/** 敲 n 下：total 与 todayCount 同增，跨天自动归零今日。 */
export function bumpMerit(rawState, n = 1, now = new Date()) {
  const state = normalizeMeritState(rawState, now);
  const step = safeInt(n, 1, 1, MERIT_STEP_MAX);
  return {
    ...state,
    total: Math.min(MERIT_TOTAL_MAX, state.total + step),
    today: meritToday(now),
    todayCount: Math.min(MERIT_TOTAL_MAX, state.todayCount + step),
  };
}

export function formatMeritTotal(state) {
  return String(normalizeMeritState(state).total);
}

/** 卡片左上角/命令返回的一行状态：只放总量，够短、够稳。 */
export function meritStatusLine(state) {
  const s = normalizeMeritState(state);
  return `功德 ${s.total}`;
}

/** 插件页副标题用：总量 + 今日。 */
export function meritDetailLine(state, now = new Date()) {
  const s = normalizeMeritState(state, now);
  return `今日 +${s.todayCount} · 累计 ${s.total}`;
}

/** 读状态；storage 读失败/为空都给默认值。 */
export function loadMeritState(ctx) {
  try {
    const api = ctx && ctx.onethu && ctx.onethu.storage;
    const raw = api && typeof api.get === "function" ? api.get(MERIT_KEY) : null;
    return normalizeMeritState(raw);
  } catch {
    return normalizeMeritState(null);
  }
}

export function saveMeritState(ctx, state) {
  try {
    const api = ctx && ctx.onethu && ctx.onethu.storage;
    if (api && typeof api.set === "function") api.set(MERIT_KEY, normalizeMeritState(state));
  } catch {
    /* 存储失败（隐私模式/配额）不影响本次敲击的内存态 */
  }
  return normalizeMeritState(state);
}

export function resetMeritState(ctx) {
  const fresh = normalizeMeritState(null);
  saveMeritState(ctx, fresh);
  return fresh;
}

export function setSoundState(ctx, on) {
  const state = loadMeritState(ctx);
  const next = { ...state, sound: Boolean(on) };
  return saveMeritState(ctx, next);
}