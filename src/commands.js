/**
 * 命令层：管理页按钮与 OH 的 list_plugin_cmds / run_plugin_cmd 都走这里。
 *
 * 约定（与 OneTHU 插件协议一致）：
 *   - 全部返回字符串（OH 对字符串原样展示，不包 JSON）；
 *   - 不做危险动作不确认：清空功德必须先过 ui.confirm（两段式）；
 *   - 错误不抛栈：拿不到宿主能力时给一句人话 + 下一步。
 */

import { loadMeritState, meritStatusLine } from "./merit.js";
import { parseTapCount, performTap, resetWoodfishMerit, toggleWoodfishSound, woodfishStatus } from "./actions.js";
import { pickVerse } from "./verses.js";
import { putWoodfishCard, removeWoodfishCard } from "./card.js";
import { setWoodfishDocked, woodfishDockAvailable, woodfishDockState } from "./page.js";

export function buildCommandList(deps) {
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

export async function handleWoodfishCommand(deps, cmdId, rawInput) {
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