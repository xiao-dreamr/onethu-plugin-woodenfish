/**
 * 白板卡片：把电子木鱼放到首页/OnePage（宿主 0.12+ 的插件交互卡片）。
 *
 * 为什么不是静态 HTML：静态卡不能点、不能加功德。交互卡片由宿主画壳，点击时跑本插件
 * 的 `tap` 命令（音效也在命令里播），返回的「功德 N」显示在卡片左上角。
 * 旧宿主没有 `ext.actionCard` 时：
 *   ① 有 `ext.homeDock` 就把插件页停靠到首页一级功能区（能敲，体验最好）；
 *   ② 连 homeDock 都没有的远古宿主，才退化成静态提示卡（能看不能敲）。
 */

import { WOODFISH_PAGE_KEY } from "./page.js";

const WOODFISH_CARD_ID = "main";
export const WOODFISH_CARD_TITLE = "电子木鱼";
export const WOODFISH_CARD_ICON = "🐟";

/** 卡片外观（宿主壳 + 本插件作用域）。数据属性由宿主渲染壳写上。 */
export const WOODFISH_CARD_CSS = `
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

export const WOODFISH_STATIC_HTML =
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
export async function putWoodfishCard(ctx, options = {}) {
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
export async function removeWoodfishCard(ctx, boardId = "") {
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