/**
 * woodenfish — OneTHU 电子木鱼插件（单文件构建产物）
 *
 * 本文件由 plugins/woodenfish/build.mjs 从 src/ 生成，请勿手改。
 * 玩法：敲电子木鱼，取赛博真经。插件页可敲、白板交互卡片可敲，功德本地累计。
 */

/* ═══════════ src/verses.js ═══════════ */
/**
 * 赛博真经（段子库）。
 *
 * 纯娱乐：每次敲木鱼有概率换一句；只做气氛，不承载任何真实教义或校园信息。
 * 文案要求：短、无害、不冒犯；不出现真实人名/机构/承诺。
 */

const VERSES = [
  "敲的是木鱼，修的是 Wi-Fi。",
  "功德 +1，烦恼 −1。",
  "心诚则灵，网速则快。",
  "一敲一菩提，一刷一世界。",
  "空即是色，色即是 DDL。",
  "既见木鱼，云胡不敲。",
  "今日不卷，明日再卷。",
  "代码无 bug，全凭心静。",
  "赛博真经第一章：早睡。",
  "放下执念，先放下手机。",
  "功德无量，流量无限。",
  "所敲皆如愿，所求皆不 404。",
  "木鱼一响，论文自带目录。",
  "敲到第七下，咖啡自动续杯。",
  "施主，今日份的 Bug 已超度。",
  "一念放下，万般 0 error。",
  "先敲三下，再谈人生。",
  "山不转水转，DDL 不转你转。",
  "无挂碍故，无有恐怖，无有早八。",
  "赛博功德，随缘到账。",
  "敲木鱼不生产功德，只是功德的搬运工。",
  "愿你所求皆坦途，所敲皆 +1。",
];

/** 随机取一句（可注入 random 便于测试）。 */
function pickVerse(random = Math.random) {
  const at = Math.floor(random() * VERSES.length) % VERSES.length;
  return VERSES[at];
}

/** 文案总量（README/测试用）。 */
function verseCount() {
  return VERSES.length;
}

/* ═══════════ src/merit.js ═══════════ */
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

function meritToday(now = new Date()) {
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
function normalizeMeritState(raw, now = new Date()) {
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
function bumpMerit(rawState, n = 1, now = new Date()) {
  const state = normalizeMeritState(rawState, now);
  const step = safeInt(n, 1, 1, MERIT_STEP_MAX);
  return {
    ...state,
    total: Math.min(MERIT_TOTAL_MAX, state.total + step),
    today: meritToday(now),
    todayCount: Math.min(MERIT_TOTAL_MAX, state.todayCount + step),
  };
}

function formatMeritTotal(state) {
  return String(normalizeMeritState(state).total);
}

/** 卡片左上角/命令返回的一行状态：只放总量，够短、够稳。 */
function meritStatusLine(state) {
  const s = normalizeMeritState(state);
  return `功德 ${s.total}`;
}

/** 插件页副标题用：总量 + 今日。 */
function meritDetailLine(state, now = new Date()) {
  const s = normalizeMeritState(state, now);
  return `今日 +${s.todayCount} · 累计 ${s.total}`;
}

/** 读状态；storage 读失败/为空都给默认值。 */
function loadMeritState(ctx) {
  try {
    const api = ctx && ctx.onethu && ctx.onethu.storage;
    const raw = api && typeof api.get === "function" ? api.get(MERIT_KEY) : null;
    return normalizeMeritState(raw);
  } catch {
    return normalizeMeritState(null);
  }
}

function saveMeritState(ctx, state) {
  try {
    const api = ctx && ctx.onethu && ctx.onethu.storage;
    if (api && typeof api.set === "function") api.set(MERIT_KEY, normalizeMeritState(state));
  } catch {
    /* 存储失败（隐私模式/配额）不影响本次敲击的内存态 */
  }
  return normalizeMeritState(state);
}

function resetMeritState(ctx) {
  const fresh = normalizeMeritState(null);
  saveMeritState(ctx, fresh);
  return fresh;
}

function setSoundState(ctx, on) {
  const state = loadMeritState(ctx);
  const next = { ...state, sound: Boolean(on) };
  return saveMeritState(ctx, next);
}

/* ═══════════ src/sound.js ═══════════ */
/**
 * 木鱼音效（WebAudio 合成，零素材、零网络）。
 *
 * 为什么合成而不是打包音频：插件是单文件文本，塞 base64 音频会让体积暴涨；
 * 木鱼声本质是「短促的木质敲击」= 一段快速衰减的三角波（腔体）+ 一小段带通噪声
 * （敲击瞬间），合成出来足够像，而且能每次微调音高，连敲不呆板。
 *
 * 边界：
 *   - 浏览器自动播放策略：AudioContext 必须在用户手势里创建/恢复。插件页第一次点击
 *     天然满足；白板卡片点击时命令在点击回调里同步执行，通常也能过（不保证，失败静默）。
 *   - Node/无 WebAudio 环境（测试）返回 false，不抛错。
 */

let WfAudioContext = null;

function wfAudioCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function wfEnsureAudio() {
  try {
    const Ctor = wfAudioCtor();
    if (!Ctor) return null;
    if (!WfAudioContext) WfAudioContext = new Ctor();
    if (WfAudioContext.state === "suspended") void WfAudioContext.resume();
    return WfAudioContext;
  } catch {
    return null;
  }
}

/**
 * 敲一下。
 * @param {number} intensity 0.05–1，默认 1（自动连敲时可调低）
 * @returns {boolean} 是否真的发声（无 WebAudio / 被策略拦截 → false）
 */
function playWoodfish(intensity = 1) {
  const ac = wfEnsureAudio();
  if (!ac) return false;
  try {
    const t0 = ac.currentTime + 0.001;
    const vol = Math.max(0.05, Math.min(1, Number(intensity) || 1));

    /* 腔体：三角波快速下滑 + 指数衰减，给出"咚"的木质主体 */
    const body = ac.createOscillator();
    const bodyGain = ac.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(720 + Math.random() * 90, t0);
    body.frequency.exponentialRampToValueAtTime(170 + Math.random() * 30, t0 + 0.07);
    bodyGain.gain.setValueAtTime(0.0001, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.5 * vol, t0 + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    body.connect(bodyGain).connect(ac.destination);
    body.start(t0);
    body.stop(t0 + 0.12);

    /* 敲击：一小段衰减噪声过带通，给出"嗒"的瞬态 */
    const len = Math.max(1, Math.floor(ac.sampleRate * 0.035));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const hit = ac.createBufferSource();
    hit.buffer = buffer;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1350 + Math.random() * 450;
    band.Q.value = 1.1;
    const hitGain = ac.createGain();
    hitGain.gain.value = 0.2 * vol;
    hit.connect(band).connect(hitGain).connect(ac.destination);
    hit.start(t0);

    return true;
  } catch {
    return false;
  }
}

/** 预热（用户第一次点木鱼时调用；失败静默）。 */
function warmWoodfishAudio() {
  return wfEnsureAudio() !== null;
}

function disposeWoodfishAudio() {
  try {
    if (WfAudioContext && typeof WfAudioContext.close === "function") void WfAudioContext.close();
  } catch {
    /* 关不掉就算了，进程退出会回收 */
  }
  WfAudioContext = null;
}

/* ═══════════ src/page.js ═══════════ */
/**
 * 插件功能页在「首页一级功能区 / OneShot」里的入口。
 *
 * 旧版本没有白板交互卡片时，这是电子木鱼的主要入口：插件页本身是宿主一等页面
 * （pageKey = plugin:<插件id>:<tabId>），可以：
 *   - 停靠到首页时间下方的「一级功能区」（`ext.homeDock`，0.11 起支持）；
 *   - 在新宿主的 OneShot / 更多功能列表里被选为快捷入口（宿主侧把插件功能页并入了
 *     可选清单；插件不需要额外调用）。
 * 本模块只封装 pageKey 与 homeDock 的读写，命令层和插件页共用一份，避免写死字符串。
 */

const WOODFISH_PAGE_KEY = "plugin:onethu.woodenfish:main";

function woodfishDockApi(ctx) {
  const ext = ctx && ctx.onethu && ctx.onethu.ext;
  const dock = ext && ext.homeDock;
  return typeof dock === "function" ? dock : null;
}

/** 当前宿主是否支持首页一级功能区停靠（旧宿主可能没有 ext.homeDock）。 */
function woodfishDockAvailable(ctx) {
  return woodfishDockApi(ctx) !== null;
}

/** 读取停靠状态；不可用/出错时返回 {available:false, docked:false}。 */
function woodfishDockState(ctx) {
  const dock = woodfishDockApi(ctx);
  if (!dock) return { available: false, docked: false };
  try {
    const snap = dock();
    const docked = Array.isArray(snap && snap.docked) ? snap.docked : [];
    return { available: true, docked: docked.includes(WOODFISH_PAGE_KEY) };
  } catch {
    return { available: true, docked: false };
  }
}

/** 停靠/取消停靠；返回最新状态与错误信息。 */
function setWoodfishDocked(ctx, on) {
  const dock = woodfishDockApi(ctx);
  if (!dock) return { ok: false, available: false, docked: false, message: "当前宿主版本不支持首页一级功能区停靠" };
  try {
    dock(WOODFISH_PAGE_KEY, Boolean(on));
    const state = woodfishDockState(ctx);
    return {
      ok: true,
      available: true,
      docked: state.docked,
      message: state.docked ? "电子木鱼已加到首页一级功能区" : "电子木鱼已从首页移除",
    };
  } catch (err) {
    return {
      ok: false,
      available: true,
      docked: woodfishDockState(ctx).docked,
      message: `操作失败：${err && err.message ? err.message : String(err)}`,
    };
  }
}

/* ═══════════ src/actions.js ═══════════ */
/**
 * 敲击动作（命令层与插件页共用）：一次敲击 = 记一笔功德 +（按设置）发声。
 *
 * 为什么单独一层：白板卡片的点击回调、插件页的点击、OH 的 run_plugin_cmd 都走
 * 同一段逻辑，避免三处各写一遍导致「卡片和页面加的数不一样」。
 */


const WOODFISH_TAP_MIN = 1;
const WOODFISH_TAP_MAX = 999;

/** 把任意输入解析成合法敲击次数（1–999；非法回 1）。 */
function parseTapCount(raw) {
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
function performTap(ctx, count = 1, opts = {}) {
  const step = parseTapCount(count);
  const state = saveMeritState(ctx, bumpMerit(loadMeritState(ctx), step));
  if (state.sound && opts.silent !== true) playWoodfish(1);
  return state;
}

/** 开关音效；打开时立即试响一声，让用户确认。 */
function toggleWoodfishSound(ctx) {
  const current = loadMeritState(ctx);
  const state = setSoundState(ctx, !current.sound);
  if (state.sound) playWoodfish(0.65);
  return state;
}

/** 清空功德（调用方负责先确认）。 */
function resetWoodfishMerit(ctx) {
  return resetMeritState(ctx);
}

/** 卡片左上角/命令状态行：只显示总量。 */
function woodfishStatus(ctx) {
  return meritStatusLine(loadMeritState(ctx));
}

/* ═══════════ src/card.js ═══════════ */
/**
 * 白板卡片：把电子木鱼放到首页/OnePage（宿主 0.12+ 的插件交互卡片）。
 *
 * 为什么不是静态 HTML：静态卡不能点、不能加功德。交互卡片由宿主画壳，点击时跑本插件
 * 的 `tap` 命令（音效也在命令里播），返回的「功德 N」显示在卡片左上角。
 * 旧宿主没有 `ext.actionCard` 时：
 *   ① 有 `ext.homeDock` 就把插件页停靠到首页一级功能区（能敲，体验最好）；
 *   ② 连 homeDock 都没有的远古宿主，才退化成静态提示卡（能看不能敲）。
 */


const WOODFISH_CARD_ID = "main";
const WOODFISH_CARD_TITLE = "电子木鱼";
const WOODFISH_CARD_ICON = "🐟";

/** 卡片外观（宿主壳 + 本插件作用域）。数据属性由宿主渲染壳写上。 */
const WOODFISH_CARD_CSS = `
[data-plugin-action="onethu.woodenfish:main"] {
  background:
    radial-gradient(130% 120% at 28% 12%, #fff8ea 0%, #f4dda9 52%, #e3bd7c 100%);
  color: #5a3714;
  box-shadow: inset 0 0 0 1px rgba(122, 74, 26, .22), 0 10px 22px rgba(96, 60, 18, .16);
}
[data-plugin-action="onethu.woodenfish:main"] .pac-status { color: #8a5a1e; letter-spacing: .2px; }
/* 用内联 SVG 画木鱼，避免依赖系统 emoji 字体（Linux 预览/旧 WebView 里 emoji 会变豆腐块） */
[data-plugin-action="onethu.woodenfish:main"] .pac-icon {
  display: block;
  width: 66%;
  height: 60%;
  font-size: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 48'%3E%3Cellipse cx='25' cy='30' rx='20' ry='11' fill='%23e0b978' stroke='%238a5a24' stroke-width='2'/%3E%3Cpath d='M9 29 Q25 20 41 29' fill='none' stroke='%238a5a24' stroke-width='2.4' stroke-linecap='round'/%3E%3Cpath d='M13 34 Q25 28 37 34' fill='none' stroke='%23c99a55' stroke-width='1.5' stroke-linecap='round' opacity='.8'/%3E%3Ccircle cx='16.5' cy='27' r='1.8' fill='%235b3712'/%3E%3Cpath d='M44 30 q5 -5 8 -2 q-3 3 -8 3 Z' fill='%23c99a55' stroke='%238a5a24' stroke-width='1.3'/%3E%3Crect x='34' y='6' width='4' height='16' rx='2' fill='%237d4f1d' transform='rotate(18 36 14)'/%3E%3Crect x='30' y='2' width='12' height='7' rx='3.5' fill='%238a5a24' transform='rotate(18 36 5)'/%3E%3C/svg%3E") center / contain no-repeat;
  filter: drop-shadow(0 8px 10px rgba(104, 64, 20, .24));
}
[data-plugin-action="onethu.woodenfish:main"] .pac-title { color: #7a4a1a; opacity: .85; }
[data-plugin-action="onethu.woodenfish:main"]:active .pac-icon { filter: drop-shadow(0 3px 4px rgba(104,64,20,.28)); }
@media (prefers-reduced-motion: reduce) {
  [data-plugin-action="onethu.woodenfish:main"] .pac-icon { animation: none; }
}
`;

const WOODFISH_STATIC_HTML =
  '<div style="text-align:center;line-height:1.6">' +
  '<div style="font-size:40px">🐟</div>' +
  "<h3 style=\"margin:4px 0\">电子木鱼</h3>" +
  '<p style="margin:0;color:#8a5a1e;font-size:12px">打开「设置 → 插件 → 电子木鱼」进入木鱼页敲击；升级 OneTHU 后此卡可点击 +1。</p>' +
  "</div>";

function woodfishExt(ctx) {
  return (ctx && ctx.onethu && ctx.onethu.ext) || null;
}

/**
 * 放/更新白板卡片。
 * @returns {Promise<{ok:boolean, via:"action"|"static"|"none", reused?:boolean, boardId?:string, id?:string, message:string}>}
 */
async function putWoodfishCard(ctx, options = {}) {
  const ext = woodfishExt(ctx);
  const boardId = typeof options.boardId === "string" && options.boardId.trim() ? options.boardId.trim() : "";
  if (ext && typeof ext.actionCard === "function") {
    try {
      const out = await ext.actionCard({
        cardId: WOODFISH_CARD_ID,
        title: WOODFISH_CARD_TITLE,
        icon: WOODFISH_CARD_ICON,
        tapCmdId: "tap",
        statusCmdId: "status",
        boardId: boardId || undefined,
        x: Number.isFinite(options.x) ? options.x : 0,
        y: Number.isFinite(options.y) ? options.y : 0,
        w: 3,
        h: 3,
      });
      const where = out && out.boardId ? (out.reused ? "已更新电子木鱼卡片" : "电子木鱼已放到白板") : "电子木鱼已放到白板";
      return {
        ok: true,
        via: "action",
        reused: Boolean(out && out.reused),
        boardId: out && out.boardId,
        id: out && out.id,
        message: `${where} · 点一下功德 +1`,
      };
    } catch (err) {
      return { ok: false, via: "action", message: `放卡片失败：${err && err.message ? err.message : String(err)}` };
    }
  }

  /* 旧宿主没有可点击卡片：优先把插件页停靠到首页一级功能区（用户点进去就能敲） */
  if (ext && typeof ext.homeDock === "function") {
    try {
      ext.homeDock(WOODFISH_PAGE_KEY, true);
      return {
        ok: true,
        via: "dock",
        message: "当前宿主不支持可点击白板卡片，已把电子木鱼加到首页一级功能区；点进去就能敲",
      };
    } catch {
      /* 停靠失败再退化到静态卡 */
    }
  }

  if (ext && typeof ext.widgetCreate === "function") {
    try {
      const out = ext.widgetCreate(WOODFISH_CARD_TITLE, WOODFISH_STATIC_HTML, 40, 300);
      return {
        ok: true,
        via: "static",
        id: out && out.id,
        message: "当前宿主还不支持可点击卡片，已放一张静态卡；请到插件页敲，或升级 OneTHU",
      };
    } catch (err) {
      return { ok: false, via: "static", message: `放卡片失败：${err && err.message ? err.message : String(err)}` };
    }
  }

  return { ok: false, via: "none", message: "当前宿主版本不支持白板卡片（需要 OneTHU 0.12+）" };
}

/** 移除白板卡片（只删本插件的卡；旧宿主的静态卡需要在白板上手动删）。 */
async function removeWoodfishCard(ctx, boardId = "") {
  const ext = woodfishExt(ctx);
  if (!ext || typeof ext.actionCardRemove !== "function") {
    return { ok: false, message: "当前宿主版本不支持移除卡片；请在白板上长按删除" };
  }
  try {
    const out = await ext.actionCardRemove(WOODFISH_CARD_ID, boardId || undefined);
    return { ok: Boolean(out && out.ok), message: out && out.ok ? "电子木鱼卡片已从白板移除" : "白板上没有这张卡" };
  } catch (err) {
    return { ok: false, message: `移除失败：${err && err.message ? err.message : String(err)}` };
  }
}

/* ═══════════ src/commands.js ═══════════ */
/**
 * 命令层：管理页按钮与 OH 的 list_plugin_cmds / run_plugin_cmd 都走这里。
 *
 * 约定（与 OneTHU 插件协议一致）：
 *   - 全部返回字符串（OH 对字符串原样展示，不包 JSON）；
 *   - 不做危险动作不确认：清空功德必须先过 ui.confirm（两段式）；
 *   - 错误不抛栈：拿不到宿主能力时给一句人话 + 下一步。
 */


function buildCommandList(deps) {
  return [
    {
      id: "tap",
      title: "敲电子木鱼（功德 +1；输入数字可连敲 N 下）",
      inputLabel: "敲几下（可空，默认 1）",
      inputPlaceholder: "例如：10",
      run: (input) => runTapCommand(deps, input),
    },
    {
      id: "status",
      title: "查看当前功德总量（今日/累计）",
      inputLabel: "无需输入",
      run: () => runStatusCommand(deps),
    },
    {
      id: "verse",
      title: "抽一句赛博真经",
      inputLabel: "无需输入",
      run: () => runVerseCommand(),
    },
    {
      id: "sound",
      title: "开/关木鱼音效",
      inputLabel: "无需输入",
      run: () => runSoundCommand(deps),
    },
    {
      id: "board",
      title: "把电子木鱼放到首页/OnePage 白板（可选 boardId）",
      inputLabel: "boardId（可空=首页）",
      inputPlaceholder: "可空；或 onePageList() 里的 boardId",
      run: (input) => runBoardCommand(deps, input),
    },
    {
      id: "board_remove",
      title: "把电子木鱼卡片从白板移除",
      inputLabel: "boardId（可空=全部板）",
      run: (input) => runBoardRemoveCommand(deps, input),
    },
    {
      id: "dock",
      title: "把电子木鱼放到首页一级功能区（或在新宿主 OneShot 里选它）",
      inputLabel: "无需输入",
      run: () => runDockCommand(deps, true),
    },
    {
      id: "undock",
      title: "把电子木鱼从首页一级功能区移除",
      inputLabel: "无需输入",
      run: () => runDockCommand(deps, false),
    },
    {
      id: "reset",
      title: "清空功德（会先向用户确认）",
      inputLabel: "无需输入",
      run: () => runResetCommand(deps),
    },
  ];
}

async function handleWoodfishCommand(deps, cmdId, rawInput) {
  const input = String(rawInput ?? "");
  const command = buildCommandList(deps).find((item) => item.id === cmdId);
  if (!command) return `【电子木鱼】未知命令 ${cmdId}。可用：tap/status/verse/sound/board/board_remove/reset。`;
  try {
    return await command.run(input);
  } catch (err) {
    return `【电子木鱼】命令没有完成：${err && err.message ? err.message : String(err)}`;
  }
}

function runTapCommand(deps, input) {
  const count = parseTapCount(input);
  const state = performTap(deps.ctx, count);
  const suffix = count > 1 ? `（连敲 ${count} 下）` : "";
  return `功德 +${count}${suffix} · 累计 ${state.total} · 今日 ${state.todayCount}`;
}

function runStatusCommand(deps) {
  const state = loadMeritState(deps.ctx);
  return `${meritStatusLine(state)} · 今日 +${state.todayCount}`;
}

function runVerseCommand() {
  return `赛博真经：${pickVerse()}`;
}

function runSoundCommand(deps) {
  const state = toggleWoodfishSound(deps.ctx);
  return `木鱼音效已${state.sound ? "开启" : "关闭"}。`;
}

async function runBoardCommand(deps, input) {
  const raw = String(input ?? "").trim();
  const boardId = /^boardId=/i.test(raw) ? raw.slice(raw.indexOf("=") + 1).trim() : raw;
  const result = await putWoodfishCard(deps.ctx, { boardId });
  return result.message;
}

async function runBoardRemoveCommand(deps, input) {
  const raw = String(input ?? "").trim();
  const boardId = /^boardId=/i.test(raw) ? raw.slice(raw.indexOf("=") + 1).trim() : raw;
  const result = await removeWoodfishCard(deps.ctx, boardId);
  return result.message;
}

function runDockCommand(deps, on) {
  if (!woodfishDockAvailable(deps.ctx)) {
    return "当前宿主版本不支持首页一级功能区停靠；请直接进「插件 → 电子木鱼」页敲，或升级 OneTHU。";
  }
  const result = setWoodfishDocked(deps.ctx, on);
  const state = woodfishDockState(deps.ctx);
  return `${result.message}${state.available ? `（当前：${state.docked ? "已停靠" : "未停靠"}）` : ""}`;
}

async function runResetCommand(deps) {
  const ui = deps.ctx && deps.ctx.onethu && deps.ctx.onethu.ui;
  if (!ui || typeof ui.confirm !== "function") {
    return "清空功德需要确认弹窗，但当前宿主没有提供 ui.confirm；请到插件页操作。";
  }
  const okay = await ui.confirm("清空全部功德？累计和今日都会归零。", {
    danger: true,
    title: "清空功德",
    confirmText: "清空",
  });
  if (!okay) return "已取消，功德保留。";
  resetWoodfishMerit(deps.ctx);
  return "功德已清空。重新开始敲吧。";
}

/* ═══════════ src/tab.js ═══════════ */
/**
 * 插件功能页「电子木鱼」：敲电子木鱼，取赛博真经。
 *
 * 页面职责（只读展示 + 本地计数，不联网）：
 *   - 左上角功德总量（大字号）+ 今日计数 + 一句赛博真经；
 *   - 中间木鱼：点击/回车/空格 → 功德 +1、音效、漂浮 +1、木鱼弹一下；
 *   - 工具栏：音效开关、自动敲、换真经、放到白板、移除卡片、清空功德（带确认）。
 *
 * 边界与实现要点：
 *   - 容器由宿主常驻，onTabReady 可能多次触发 → render 必须幂等：先清空、再重建，
 *     同时清掉上一次的定时器与漂浮元素（否则切页回来会双倍计时）；
 *   - 页面只改插件自己的 localStorage（经 ctx.onethu.storage），不碰宿主状态；
 *   - 自动敲在页面不可见时暂停（document.hidden / offsetParent 为 null），避免后台空转；
 *   - 音效被浏览器策略拦截时静默降级：计数照常，不弹错。
 */


const WOODFISH_TAB_CSS = `
[data-plg="onethu.woodenfish"] .wf-root {
  position: relative;
  box-sizing: border-box;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
  overflow: auto;
  background:
    radial-gradient(90% 70% at 50% 0%, var(--accent-soft, rgba(214, 167, 96, .16)) 0%, transparent 70%),
    linear-gradient(180deg, var(--surface, #fbf7ef) 0%, var(--bg-soft, #f4eee2) 100%);
  color: var(--text-1, #2a2118);
}
[data-plg="onethu.woodenfish"] .wf-merit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  pointer-events: none;
}
[data-plg="onethu.woodenfish"] .wf-merit-label {
  font-size: 12px;
  letter-spacing: .22em;
  color: var(--text-3, #9a8a74);
}
[data-plg="onethu.woodenfish"] .wf-merit-num {
  font-size: clamp(34px, 6vw, 52px);
  line-height: 1;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #7a4a1a;
  text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
}
[data-plg="onethu.woodenfish"] .wf-merit-detail {
  font-size: 12px;
  color: var(--text-3, #9a8a74);
}
[data-plg="onethu.woodenfish"] .wf-verse {
  max-width: min(78vw, 520px);
  min-height: 20px;
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--text-2, #6b5a44);
  opacity: .92;
}
[data-plg="onethu.woodenfish"] .wf-verse.is-swap { animation: wf-verse-in .4s ease; }
[data-plg="onethu.woodenfish"] .wf-stage {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 220px;
  display: grid;
  place-items: center;
  touch-action: manipulation;
}
[data-plg="onethu.woodenfish"] .wf-fish {
  border: 0;
  padding: 0;
  background: transparent;
  width: min(72vw, 360px);
  max-width: 88%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s ease;
  will-change: transform;
}
[data-plg="onethu.woodenfish"] .wf-fish:active { transform: scale(.97); }
[data-plg="onethu.woodenfish"] .wf-fish:focus-visible { outline: 2px solid var(--accent, #b45309); outline-offset: 8px; border-radius: 24px; }
[data-plg="onethu.woodenfish"] .wf-fish svg { display: block; width: 100%; height: auto; }
[data-plg="onethu.woodenfish"] .wf-fish-svg { filter: drop-shadow(0 22px 26px rgba(96, 60, 18, .22)); }
[data-plg="onethu.woodenfish"] .wf-mallet { transform-origin: 158px 20px; }
[data-plg="onethu.woodenfish"] .wf-fish.is-hit .wf-mallet { animation: wf-mallet-hit .18s ease; }
[data-plg="onethu.woodenfish"] .wf-float {
  position: absolute;
  pointer-events: none;
  user-select: none;
  font-size: 20px;
  font-weight: 800;
  color: #b45309;
  text-shadow: 0 1px 0 rgba(255, 255, 255, .7);
  animation: wf-float-up .72s ease-out forwards;
}
[data-plg="onethu.woodenfish"] .wf-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  width: 100%;
  max-width: 620px;
}
[data-plg="onethu.woodenfish"] .wf-btn {
  font: inherit;
  font-size: 13px;
  color: var(--text-1, #2a2118);
  background: var(--surface-2, rgba(255, 255, 255, .66));
  border: 1px solid var(--border, rgba(122, 90, 48, .24));
  border-radius: 999px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background .15s ease, transform .1s ease;
}
[data-plg="onethu.woodenfish"] .wf-btn:hover { background: var(--hover, rgba(122, 90, 48, .1)); }
[data-plg="onethu.woodenfish"] .wf-btn:active { transform: scale(.97); }
[data-plg="onethu.woodenfish"] .wf-btn[data-on="1"] { background: #f0d9a8; border-color: #c99a55; color: #6b4318; font-weight: 650; }
[data-plg="onethu.woodenfish"] .wf-btn[data-danger="1"] { color: #a13d2a; border-color: rgba(161, 61, 42, .35); }
[data-plg="onethu.woodenfish"] .wf-hint { margin: 0; font-size: 12px; color: var(--text-3, #9a8a74); text-align: center; }
@keyframes wf-float-up {
  0% { opacity: 0; transform: translateY(6px) scale(.8); }
  18% { opacity: 1; transform: translateY(0) scale(1.05); }
  100% { opacity: 0; transform: translateY(-56px) scale(1); }
}
@keyframes wf-mallet-hit {
  0% { transform: rotate(0deg); }
  45% { transform: rotate(-16deg) translateY(4px); }
  100% { transform: rotate(0deg); }
}
@keyframes wf-verse-in {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: .92; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  [data-plg="onethu.woodenfish"] .wf-float,
  [data-plg="onethu.woodenfish"] .wf-fish.is-hit .wf-mallet,
  [data-plg="onethu.woodenfish"] .wf-verse.is-swap { animation: none; }
}
@media (max-width: 720px) {
  [data-plg="onethu.woodenfish"] .wf-root { gap: 6px; padding: 12px; }
}
`;

const WOODFISH_SVG = `
<svg class="wf-fish-svg" viewBox="0 0 240 190" aria-hidden="true">
  <defs>
    <linearGradient id="wf-wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8e6be"/>
      <stop offset=".55" stop-color="#e0b978"/>
      <stop offset="1" stop-color="#b9853f"/>
    </linearGradient>
    <linearGradient id="wf-wood-dark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a97433"/>
      <stop offset="1" stop-color="#7d4f1d"/>
    </linearGradient>
    <radialGradient id="wf-glow" cx=".5" cy=".35" r=".7">
      <stop offset="0" stop-color="#fff6df" stop-opacity=".9"/>
      <stop offset="1" stop-color="#fff6df" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="118" cy="150" rx="88" ry="12" fill="rgba(96,60,18,.12)"/>
  <ellipse cx="118" cy="118" rx="92" ry="14" fill="url(#wf-glow)"/>
  <g class="wf-mallet">
    <rect x="150" y="20" width="13" height="74" rx="6.5" fill="url(#wf-wood-dark)" transform="rotate(20 156 57)"/>
    <rect x="132" y="2" width="50" height="30" rx="12" fill="#8a5a24" transform="rotate(20 157 17)"/>
    <rect x="136" y="5" width="42" height="9" rx="4.5" fill="#a97433" opacity=".7" transform="rotate(20 157 9)"/>
  </g>
  <g>
    <path d="M28 120 Q112 58 196 116 Q186 156 116 160 Q48 158 28 120 Z" fill="url(#wf-wood)" stroke="#8a5a24" stroke-width="3"/>
    <path d="M44 118 Q116 88 184 116" fill="none" stroke="#8a5a24" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 132 Q116 108 178 130" fill="none" stroke="#c99a55" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <circle cx="80" cy="110" r="7" fill="#5b3712"/>
    <circle cx="82.5" cy="107.5" r="2.4" fill="#fff7e8"/>
    <path d="M196 116 q30 -20 42 -6 q-14 12 -42 10 Z" fill="#c99a55" stroke="#8a5a24" stroke-width="2.5"/>
    <path d="M62 146 q54 12 110 2" fill="none" stroke="#a97433" stroke-width="2" opacity=".5" stroke-linecap="round"/>
    <path d="M74 96 q44 -26 92 -4" fill="none" stroke="#f8e6be" stroke-width="2.2" opacity=".55" stroke-linecap="round"/>
  </g>
</svg>`;

function wfEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function createWoodfishTab(deps) {
  const state = {
    autoTimer: null,
    floatTimers: new Set(),
    keyHandler: null,
    verse: pickVerse(),
    tapsSinceVerse: 0,
    disposed: false,
  };

  function clearTimers() {
    if (state.keyHandler) {
      try { window.removeEventListener("keydown", state.keyHandler); } catch { /* ignore */ }
      state.keyHandler = null;
    }
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
    for (const timer of state.floatTimers) clearTimeout(timer);
    state.floatTimers.clear();
  }

  function toast(message) {
    try {
      const ui = deps.ctx.onethu && deps.ctx.onethu.ui;
      if (ui && typeof ui.toast === "function") ui.toast(message);
    } catch {
      /* toast 失败不影响主流程 */
    }
  }

  function render(root) {
    clearTimers();
    root.replaceChildren();
    root.dataset.plg = "onethu.woodenfish";

    const wrap = wfEl("div", "wf-root");

    /* 左上角：功德总量（需求里的"左上角显示功德总量"） */
    const merit = wfEl("div", "wf-merit");
    const label = wfEl("span", "wf-merit-label", "功德");
    const number = wfEl("span", "wf-merit-num", "0");
    const detail = wfEl("span", "wf-merit-detail", "");
    merit.append(label, number, detail);

    const verse = wfEl("div", "wf-verse", state.verse);

    const stage = wfEl("div", "wf-stage");
    const fish = wfEl("button", "wf-fish");
    fish.type = "button";
    fish.setAttribute("aria-label", "敲一下电子木鱼，功德加一");
    fish.innerHTML = WOODFISH_SVG;
    stage.appendChild(fish);

    const tools = wfEl("div", "wf-tools");
    const soundBtn = wfEl("button", "wf-btn");
    soundBtn.type = "button";
    const autoBtn = wfEl("button", "wf-btn");
    autoBtn.type = "button";
    const verseBtn = wfEl("button", "wf-btn", "求一段真经");
    verseBtn.type = "button";
    const cardBtn = wfEl("button", "wf-btn", "放到白板");
    cardBtn.type = "button";
    const removeBtn = wfEl("button", "wf-btn", "移除卡片");
    removeBtn.type = "button";
    const dockBtn = wfEl("button", "wf-btn", "加到首页");
    dockBtn.type = "button";
    const resetBtn = wfEl("button", "wf-btn", "清空功德");
    resetBtn.type = "button";
    resetBtn.dataset.danger = "1";
    tools.append(soundBtn, autoBtn, verseBtn, dockBtn, cardBtn, removeBtn, resetBtn);

    const hint = wfEl("p", "wf-hint", "敲电子木鱼，取赛博真经 · 点击木鱼功德 +1（连点更爽）");

    wrap.append(merit, verse, stage, tools, hint);
    root.appendChild(wrap);

    function paint() {
      const meritState = loadMeritState(deps.ctx);
      number.textContent = String(meritState.total);
      detail.textContent = `${meritDetailLine(meritState)} · 0b${meritState.total.toString(2)}`;
      soundBtn.textContent = `音效：${meritState.sound ? "开" : "关"}`;
      soundBtn.dataset.on = meritState.sound ? "1" : "0";
      autoBtn.textContent = state.autoTimer ? "自动敲：开" : "自动敲：关";
      autoBtn.dataset.on = state.autoTimer ? "1" : "0";
      const dock = woodfishDockState(deps.ctx);
      dockBtn.hidden = !dock.available;
      dockBtn.textContent = dock.docked ? "从首页移除" : "加到首页";
      dockBtn.dataset.on = dock.docked ? "1" : "0";
    }

    function setVerse(next) {
      state.verse = next;
      verse.textContent = next;
      verse.classList.remove("is-swap");
      void verse.offsetWidth;
      verse.classList.add("is-swap");
    }

    function spawnFloat() {
      if (state.floatTimers.size > 12) return;
      const span = wfEl("span", "wf-float", "+1");
      span.style.left = `${42 + Math.random() * 20}%`;
      span.style.top = `${52 + Math.random() * 10}%`;
      stage.appendChild(span);
      const timer = setTimeout(() => {
        state.floatTimers.delete(timer);
        span.remove();
      }, 760);
      state.floatTimers.add(timer);
    }

    function animateFish() {
      try {
        if (typeof fish.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
          fish.animate(
            [
              { transform: "scale(1) rotate(0deg)" },
              { transform: "scale(.94) rotate(-1.4deg)" },
              { transform: "scale(1.02) rotate(.6deg)" },
              { transform: "scale(1) rotate(0deg)" },
            ],
            { duration: 190, easing: "ease-out" },
          );
        }
      } catch {
        /* 动画失败不影响计数 */
      }
      fish.classList.add("is-hit");
      setTimeout(() => fish.classList.remove("is-hit"), 190);
    }

    function tap(options = {}) {
      performTap(deps.ctx, 1, options.silent ? { silent: true } : {});
      state.tapsSinceVerse += 1;
      if (state.tapsSinceVerse >= 13) {
        state.tapsSinceVerse = 0;
        setVerse(pickVerse());
      }
      paint();
      animateFish();
      if (!options.silent) spawnFloat();
    }

    /* 原生 button 的 Enter/Space 会自动合成 click；不要再挂 keydown，否则键盘会敲两下 */
    fish.addEventListener("click", () => tap());

    /* 全局空格：与参考实现一致（鼠标/键盘都能敲）。只在页面可见且没在输入时生效。 */
    state.keyHandler = (event) => {
      if (event.key !== " " && event.code !== "Space") return;
      const target = event.target;
      const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable)) return;
      if (!root.isConnected || root.getClientRects().length === 0) return;
      event.preventDefault();
      tap();
    };
    window.addEventListener("keydown", state.keyHandler);

    soundBtn.addEventListener("click", () => {
      toggleWoodfishSound(deps.ctx);
      paint();
    });

    autoBtn.addEventListener("click", () => {
      if (state.autoTimer) {
        clearInterval(state.autoTimer);
        state.autoTimer = null;
        paint();
        return;
      }
      state.autoTimer = setInterval(() => {
        if (state.disposed) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        if (!root.isConnected || root.getClientRects().length === 0) return;
        tap();
      }, 340);
      paint();
      toast("自动敲已开启：再点一次停止");
    });

    verseBtn.addEventListener("click", () => {
      setVerse(pickVerse());
      toast("赛博真经已更新");
    });

    dockBtn.addEventListener("click", () => {
      if (!woodfishDockAvailable(deps.ctx)) {
        toast("当前宿主版本不支持首页一级功能区停靠");
        return;
      }
      const now = woodfishDockState(deps.ctx).docked;
      const result = setWoodfishDocked(deps.ctx, !now);
      toast(result.message);
      paint();
    });

    cardBtn.addEventListener("click", () => {
      void putWoodfishCard(deps.ctx).then((result) => toast(result.message));
    });

    removeBtn.addEventListener("click", () => {
      void removeWoodfishCard(deps.ctx).then((result) => toast(result.message));
    });

    resetBtn.addEventListener("click", () => {
      void (async () => {
        const ui = deps.ctx.onethu && deps.ctx.onethu.ui;
        if (!ui || typeof ui.confirm !== "function") {
          toast("当前宿主没有确认弹窗，清空失败");
          return;
        }
        const okay = await ui.confirm("清空全部功德？累计和今日都会归零。", {
          danger: true,
          title: "清空功德",
          confirmText: "清空",
        });
        if (!okay) return;
        resetWoodfishMerit(deps.ctx);
        paint();
        toast("功德已清空，重新开始敲吧");
      })();
    });

    paint();
  }

  function dispose() {
    state.disposed = true;
    clearTimers();
  }

  return { render, dispose };
}

/* ═══════════ src/index.js ═══════════ */
/**
 * woodenfish · 插件入口：电子木鱼（娱乐向）。
 *
 * 敲电子木鱼，取赛博真经。
 *   - 插件页「电子木鱼」：点木鱼 +1（音效/动画/漂浮字），左上角功德总量，今日/累计；
 *   - 白板交互卡片：`ext.actionCard` 把木鱼放到首页或 OnePage，点一下 +1，
 *     卡片左上角显示 `功德 N`（由 `tap` 命令返回）；
 *   - 七个命令：tap / status / verse / sound / board / board_remove / reset，
 *     OH 经 list_plugin_cmds + run_plugin_cmd 可直接调用。
 *
 * 权限最小集：ui（命令结果/功能页/卡片）、storage（本机功德账本）、css（页面样式）。
 * 不联网、不读课程数据、不上传任何内容。
 */


const manifest = {
  id: "onethu.woodenfish",
  name: "电子木鱼 · 赛博真经",
  version: "0.1.0",
  kind: "js",
  entry: "plugin.js",
  author: "xiao-dreamr",
  repo: "https://github.com/xiao-dreamr/onethu-plugin-woodenfish",
  announce: true,
  description:
    "娱乐向插件：敲电子木鱼，取赛博真经。插件页大木鱼点一下功德 +1（音效+动画+飘字，上方中间显示总量），可停靠到首页一级功能区或加入 OneShot；新宿主还可在首页/OnePage 放可点击交互卡片。功德只存在本机。",
  permissions: ["ui", "storage", "css"],
};

const WOODFISH_TAB_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.6 8.2c2.6-3.8 6.4-4.6 9.4-3.1 1.5.7 2.6 1.9 3.4 3.1-2.2 2.9-5.9 3.6-8.9 2.2-1.6-.7-2.9-1.6-3.9-2.2Z"/><path d="M11 3.2l1.1 1.6"/><circle cx="4.6" cy="7.4" r=".55" fill="currentColor" stroke="none"/></svg>';

async function activate(ctx) {
  const deps = { ctx };

  for (const cmd of buildCommandList(deps)) {
    ctx.registerCommand(
      {
        id: cmd.id,
        title: cmd.title,
        inputLabel: cmd.inputLabel,
        inputPlaceholder: cmd.inputPlaceholder,
      },
      (input) => handleWoodfishCommand(deps, cmd.id, input),
    );
  }

  const tab = createWoodfishTab(deps);
  try {
    const ui = ctx.onethu && ctx.onethu.ui;
    if (ui && typeof ui.onTabReady === "function") {
      ctx.registerTab({ id: "main", title: "电子木鱼", iconSvg: WOODFISH_TAB_ICON });
      ui.onTabReady(WOODFISH_PAGE_KEY, (root) => tab.render(root));
      if (typeof ctx.registerCss === "function") {
        ctx.registerCss(`${WOODFISH_TAB_CSS}\n${WOODFISH_CARD_CSS}`);
      }
    }
  } catch (err) {
    try {
      ctx.log(`[woodenfish] 功能页注册失败（命令不受影响）：${err && err.message ? err.message : String(err)}`);
    } catch {
      /* 日志失败不影响插件 */
    }
  }

  try {
    ctx.log(`[woodenfish] 已激活 v${manifest.version}：敲电子木鱼，取赛博真经。`);
  } catch {
    /* ignore */
  }

  return {
    dispose() {
      tab.dispose();
      disposeWoodfishAudio();
    },
  };
}

export { manifest };
export default activate;
