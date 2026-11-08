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
/* 与参考实现一致的白色鱼形剪影；深色卡面 + 灰白状态字 */
.plugin-action-card[data-plugin-action="onethu.woodenfish:main"] {
  background: #111;
  color: #eee;
  box-shadow: inset 0 0 0 1px #2a2a2a, 0 10px 22px rgba(0, 0, 0, .35);
}
.plugin-action-card[data-plugin-action="onethu.woodenfish:main"] .pac-status { color: #eee; letter-spacing: .2px; }
.plugin-action-card[data-plugin-action="onethu.woodenfish:main"] .pac-icon {
  display: block;
  width: 74%;
  height: 62%;
  font-size: 0;
  background: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20247%20197%22%3E%3Cpath%20fill%3D%22%23eee%22%20d%3D%22M%20109.12%206.53%20C%20124.09%204.27%20139.37%202.82%20154.47%204.79%20C%20173.07%207.14%20191.38%2014.02%20206.02%2025.89%20C%20217.01%2034.77%20225.17%2046.63%20231.55%2059.13%20C%20237.81%2072.25%20241.16%2086.53%20243.92%20100.74%20C%20225.49%20104.75%20206.58%20105.76%20187.77%20106.20%20C%20186.21%20100.02%20183.12%2093.94%20177.74%2090.25%20C%20172.00%2085.96%20163.98%2084.19%20157.26%2087.18%20C%20145.99%2091.69%20139.62%20105.22%20142.63%20116.85%20C%20145.12%20127.39%20154.97%20136.11%20166.05%20135.69%20C%20176.18%20134.97%20184.61%20126.81%20187.19%20117.22%20C%20192.74%20116.73%20198.32%20116.63%20203.89%20116.32%20C%20217.57%20115.26%20231.14%20113.14%20244.82%20111.98%20C%20245.52%20121.28%20246.13%20130.75%20244.11%20139.94%20C%20242.32%20149.02%20239.23%20158.07%20233.39%20165.39%20C%20224.88%20176.55%20212.15%20183.64%20199.01%20187.98%20C%20187.42%20191.86%20175.20%20193.41%20163.05%20194.29%20C%20140.40%20195.87%20117.64%20195.62%2094.99%20194.19%20C%2074.79%20192.81%2054.55%20190.78%2034.79%20186.17%20C%2027.91%20184.54%2021.07%20182.47%2014.77%20179.21%20C%208.58%20175.93%204.23%20169.71%202.72%20162.92%20C%20-0.48%20151.41%203.00%20139.09%209.20%20129.21%20C%2014.61%20119.75%2027.61%20116.88%2030.81%20105.83%20C%2035.50%2090.01%2037.28%2073.40%2042.87%2057.82%20C%2047.56%2045.36%2054.34%2033.26%2064.82%2024.75%20C%2077.25%2014.19%2093.24%209.04%20109.12%206.53%20Z%22%2F%3E%3C%2Fsvg%3E") center / contain no-repeat;
  filter: drop-shadow(0 0 10px rgba(238, 238, 238, .10));
}
.plugin-action-card[data-plugin-action="onethu.woodenfish:main"] .pac-title { color: #777; opacity: 1; }
.plugin-action-card[data-plugin-action="onethu.woodenfish:main"]:active .pac-icon { filter: drop-shadow(0 0 6px rgba(238, 238, 238, .18)); }
@media (prefers-reduced-motion: reduce) {
  .plugin-action-card[data-plugin-action="onethu.woodenfish:main"] .pac-icon { animation: none; }
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