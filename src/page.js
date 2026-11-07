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

export const WOODFISH_PAGE_KEY = "plugin:onethu.woodenfish:main";

export function woodfishDockApi(ctx) {
  const ext = ctx && ctx.onethu && ctx.onethu.ext;
  const dock = ext && ext.homeDock;
  return typeof dock === "function" ? dock : null;
}

/** 当前宿主是否支持首页一级功能区停靠（旧宿主可能没有 ext.homeDock）。 */
export function woodfishDockAvailable(ctx) {
  return woodfishDockApi(ctx) !== null;
}

/** 读取停靠状态；不可用/出错时返回 {available:false, docked:false}。 */
export function woodfishDockState(ctx) {
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
export function setWoodfishDocked(ctx, on) {
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