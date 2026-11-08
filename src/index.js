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

import { buildCommandList, handleWoodfishCommand } from "./commands.js";
import { createWoodfishTab, WOODFISH_TAB_CSS } from "./tab.js";
import { WOODFISH_CARD_CSS } from "./card.js";
import { disposeWoodfishAudio } from "./sound.js";
import { WOODFISH_PAGE_KEY } from "./page.js";

const manifest = {
  id: "onethu.woodenfish",
  name: "电子木鱼 · 赛博真经",
  version: "0.1.2",
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
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2.6 12c2.9-3.5 6.5-5.2 10.4-5.2 3.4 0 6.4 1.4 8.3 3.7l2.1-1.5v6l-2.1-1.5c-1.9 2.3-4.9 3.7-8.3 3.7-3.9 0-7.5-1.7-10.4-5.2Zm6.6-1.1a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Z"/></svg>';

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