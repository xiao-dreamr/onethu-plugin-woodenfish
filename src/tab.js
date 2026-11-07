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

import { loadMeritState, meritDetailLine } from "./merit.js";
import { performTap, resetWoodfishMerit, toggleWoodfishSound } from "./actions.js";
import { pickVerse } from "./verses.js";
import { putWoodfishCard, removeWoodfishCard } from "./card.js";
import { setWoodfishDocked, woodfishDockAvailable, woodfishDockState } from "./page.js";

export const WOODFISH_TAB_CSS = `
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

export function createWoodfishTab(deps) {
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