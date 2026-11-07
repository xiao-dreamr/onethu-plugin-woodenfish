# woodenfish · 电子木鱼（OneTHU 插件）

> 敲电子木鱼，取赛博真经。
> 插件 id `onethu.woodenfish` · 娱乐向 · 无联网、无数据上传。
>
> 仓库：<https://github.com/xiao-dreamr/onethu-plugin-woodenfish>

一个纯娱乐插件：在 OneTHU 里敲木鱼攒「功德」。两种敲法：

1. **插件页「电子木鱼」**：整页就是一只大木鱼，点一下 → 功德 +1、木鱼弹一下、
   飘一个 +1、播一声木质「咚」；**上方中间**显示功德总量（另有今日计数与二进制彩蛋）。
   页面可停靠到**首页一级功能区**，也会出现在 **OneShot / 更多功能**的候选里。
2. **白板交互卡片**：把木鱼放到首页或任意 OnePage 白板，点一下功德 +1，
   卡片左上角实时显示 `功德 N`（数据来自插件自己的 `status` 命令）。

> 娱乐功能：功德只存在本机插件存储里，不联网、不上传，也不影响任何真实功能。

## 安装

**方式一：粘贴（当前）**

1. 构建单文件：`node build.mjs`（产物 `plugin.js`）；
2. 应用内 **设置 → 插件 → 安装插件 → 粘贴代码**，粘贴 `plugin.js` 全文；
3. 权限确认：`ui`、`storage`、`css`（均为展示/本地存储类，无网络权限）。

**方式二：GitHub 仓库直装（推荐）**

设置 → 插件 → 安装插件 → GitHub 仓库 → 输入：

```
xiao-dreamr/onethu-plugin-woodenfish
```

应用从仓库根目录拉取入口 `plugin.js`，之后插件卡片「检查更新」可直接拉最新版。

安装后：进插件页敲；点「加到首页」把页面放到首页一级功能区；或在 OneShot /「更多功能」
里选「电子木鱼」作为快捷入口。

## 白板卡片

卡片由宿主渲染（插件只提供标题/图标/命令），所以能跟着白板一起拖动、缩放、删除：

- 放到**首页**：插件页点「放到白板」，或命令 `board`（不带 boardId）；
- 旧宿主没有 `ext.actionCard` 时，卡片会自动退化成一张静态提示卡（不能点），
  此时请用插件页 + 首页一级功能区（下面的 `dock`）作为入口；
- 放到**某块 OnePage**：`board` 命令输入 `boardId=board.user.xxxx`（`onePageList()` 可见）；
- 同一 `cardId` 重复放置 = **就地更新**，不会长第二张；
- 移除：插件页点「移除卡片」或命令 `board_remove`；
- 插件停用后卡片保留并显示「插件已停用」，点击不执行。

卡片外观可以用插件 CSS 覆盖：选择器以 `[data-plugin-action="onethu.woodenfish:main"]` 限定作用域。

## 首页一级功能区 / OneShot

- **一级功能区**：插件页点「加到首页」（或命令 `dock`）→ 宿主首页时钟下方多一颗
  「电子木鱼」球，点进去就是整页大木鱼；再点「从首页移除」（`undock`）取消。
- **OneShot**：新宿主把插件功能页并入快速入口候选，在 OneShot 配置 /「更多功能」里
  选「电子木鱼」即可。旧宿主没有这条通道时用上面的首页一级功能区，能力不丢。

## 命令（OH 也可用）

`list_plugin_cmds` 后发现，`run_plugin_cmd(pluginId="onethu.woodenfish", cmdId=…, input=…)` 调用：

| 命令 | 作用 | 输入 |
|---|---|---|
| `tap` | 敲木鱼，功德 +1 | 可选数字：连敲 N 下（1–999） |
| `status` | 查看功德总量与今日 | 无 |
| `verse` | 抽一句赛博真经 | 无 |
| `sound` | 开关木鱼音效 | 无 |
| `board` | 把木鱼放到首页/OnePage | 可选 `boardId=…` |
| `board_remove` | 移除白板卡片 | 可选 `boardId=…` |
| `dock` | 加到首页一级功能区 | 无 |
| `undock` | 从首页一级功能区移除 | 无 |
| `reset` | 清空功德（**先弹确认**） | 无 |

对 OH 说：「帮我敲三下电子木鱼」「看看我攒了多少功德」「把木鱼放到首页」都可以。

## 权限与数据

| 权限 | 用途 |
|---|---|
| `ui` | 注册命令/功能页、放白板卡片、确认弹窗 |
| `storage` | 本机功德账本（`merit.v1`：累计、今日、音效开关） |
| `css` | 插件页与卡片的作用域样式 |

不申请 `net:external`、不读课程/账号数据；`reset` 需要二次确认。

## 架构

```
src/
├── index.js     manifest + activate（命令/功能页/样式接线）
├── commands.js  七个命令（管理页与 OH 共用）
├── actions.js   敲击动作（记账 + 音效），三个入口共用
├── merit.js     功德账本纯逻辑 + localStorage 持久化（跨天归零、坏值回落）
├── sound.js     WebAudio 合成木鱼声（零素材、手势内创建 AudioContext）
├── card.js      白板交互卡片（宿主 0.12+；旧宿主退化成静态提示卡）
├── page.js      插件页在首页一级功能区 / OneShot 的入口（homeDock 封装）
├── tab.js       插件页（木鱼 SVG / 动画 / 漂浮 +1 / 工具栏）
└── verses.js    赛博真经段子库
```

构建：`node build.mjs` 把 `src/**` 按固定顺序拼成 `plugin.js`；`--check` 校验产物与源码同步。

宿主侧白板交互卡片实现在 OneTHU 主仓库：`apps/desktop/src/state/pluginAction.ts`（纯数据）、
`components/PluginActionCard.tsx`（渲染壳）、`plugins/facade.ts` 的 `ext.actionCard`。

## 测试

```bash
node build.mjs --check
node --test $(find test -name '*.test.mjs' | sort)
```

覆盖：账本纯逻辑（跨天/上限/坏值）、九个命令（含两段式确认、旧宿主回退、停靠/取消停靠）、
构建产物自包含性、manifest 一致性、从 `plugin.js` 激活并真实敲击。

## 边界

- 音效依赖 WebAudio 与浏览器手势策略：首次点击通常可用，被策略拦截时**静默降级**（计数照常）。
- 白板卡片需要宿主提供 `ext.actionCard`（本仓库 0.12+）；旧宿主会退化成一张静态提示卡。
- 功德是本地娱乐数据，不做云同步；清空不可恢复。
- 自动敲只在插件页可见时运行；切走页面自动暂停。