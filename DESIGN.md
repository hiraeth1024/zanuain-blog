---
name: Zanuain
description: 个人学习笔记站；白色默认、可持久化的浅色与深色语义主题。
colors:
  light-canvas: "#ffffff"
  light-surface: "#ffffff"
  light-subtle: "#f6f5f4"
  light-text: "rgb(0 0 0 / 90%)"
  light-strong: "#111111"
  light-muted: "#615d59"
  light-line: "rgb(0 0 0 / 8%)"
  light-blue: "#0067c4"
  light-accent-soft: "#e6f3fe"
  light-accent-fill: "#0075de"
  light-on-accent: "#ffffff"
  light-button-hover: "#111111"
  light-highlight: "#f6d5b8"
  light-highlight-ink: "#111111"
  light-heat-0: "#f6f5f4"
  light-heat-1: "#b8d8f6"
  light-heat-2: "#8cbaed"
  light-heat-3: "#59a5e9"
  light-heat-4: "#0075de"
  light-heat-ink: "#111111"
  light-heat-strong-ink: "#ffffff"
  dark-canvas: "#191919"
  dark-surface: "#202020"
  dark-subtle: "#292929"
  dark-text: "#ededeb"
  dark-strong: "#f7f7f5"
  dark-muted: "#b5b3af"
  dark-line: "rgb(255 255 255 / 12%)"
  dark-blue: "#82bcf5"
  dark-accent-soft: "#203346"
  dark-accent-fill: "#0075de"
  dark-on-accent: "#ffffff"
  dark-button-hover: "#166fbd"
  dark-highlight: "#62432d"
  dark-highlight-ink: "#ffe0c2"
  dark-heat-0: "#2b2b2b"
  dark-heat-1: "#24496b"
  dark-heat-2: "#2d6b9e"
  dark-heat-3: "#3c91cd"
  dark-heat-4: "#82bcf5"
  dark-heat-ink: "#ffffff"
  dark-heat-strong-ink: "#111111"
typography:
  display:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.028em"
  title:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "NotionInter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  small: "4px"
  buttons: "8px"
  cards: "12px"
  pills: "9999px"
spacing:
  space-4: "4px"
  space-8: "8px"
  space-12: "12px"
  space-16: "16px"
  space-20: "20px"
  space-24: "24px"
  space-28: "28px"
  space-32: "32px"
  space-36: "36px"
  space-40: "40px"
  space-48: "48px"
  space-64: "64px"
  space-80: "80px"
components:
  theme-toggle:
    textColor: "{colors.light-muted}"
    rounded: "{rounded.buttons}"
    size: "38px"
  button-primary:
    backgroundColor: "{colors.light-accent-fill}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.buttons}"
    padding: "10px 18px"
  search-input:
    textColor: "{colors.light-text}"
    rounded: "{rounded.buttons}"
    padding: "14px 16px"
  navigation:
    textColor: "{colors.light-muted}"
    rounded: "{rounded.buttons}"
    padding: "8px 16px"
  tag-chip:
    backgroundColor: "{colors.light-accent-soft}"
    textColor: "{colors.light-blue}"
    rounded: "{rounded.pills}"
    padding: "5px 12px"
  panel:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.cards}"
    padding: "24px"
---
# Design System: Zanuain

## Overview

**Creative North Star: "个人学习笔记"**

沿用用户指定的 Notion 参考：系统无衬线字体、蓝色强调、细边框和舒适留白。默认纯白，深色用炭灰画布、分层灰面与浅蓝强调；布局和阅读层级保持一致。

本文件记录用户明确授权的全局主题扩展。原始 [DESIGN/DESIGN.md](DESIGN/DESIGN.md)、[variables.css](DESIGN/variables.css)、[theme.css](DESIGN/theme.css) 与 [tokens.json](DESIGN/tokens.json) 仍是视觉参考，保持原稿；用户指定的纯白默认覆盖参考中的暖白画布。关于终端是固定深色的局部例外。布局方向见 [site-layout.md](.impeccable/site-layout.md)。

**Key Characteristics:**

- 白色默认，显式切换并记住选择。
- 语义颜色适配全站；原始参考色板固定。
- 无阴影、无渐变；圆角与边框延续原规范。

## Colors

### Primary

Notion Blue 用于实心主按钮；正文链接、当前导航和键盘焦点使用语义蓝色。深色链接为浅蓝，主按钮仍用原蓝配白字。

### Neutral

前置 token 为规范值，`light-*` / `dark-*` 分别逐项对应 [themes.css](src/styles/themes.css) 中的 `--*`。画布、面板、局部浅底、正文、强文字、次文字与细线提供层级；高亮和发布热力图各有配套前景色。组件 token 展示浅色基态，运行时通过同名语义变量获得深色值。

**The Semantic Theme Rule.** 只切换语义变量；保留原始参考色板与关于终端内部的颜色、字体、焦点和会话状态。

## Typography

字体使用原 `--font-notioninter` 系统后备栈；没有加载 NotionInter 或 Lyon Text 字体文件。前置角色值取自实际桌面显示：站名 display、页标题 headline、笔记标题 title、正文 body、导航 label、元信息 caption。说明为14px；Markdown 正文行高1.9，代码使用 SFMono-Regular / Consolas / monospace。手机站名72px，≤480px 时为 `clamp(54px, 16vw, 72px)`；文章标题依次降至32px、30px，正文降至15px。浅深主题共用排版。

## Layout

居中容器最大1160px（含24px侧内边距），顶部67px（66px内容与1px底边框），正文上下48px。首页介绍最小高度为视口动态高度减去导航高度，背景铺满导航以下的首屏；最新笔记从视口底边开始，低矮屏幕由内容自然撑高，不裁切。首页正文与300px侧栏间距40px；≤1040px 时侧栏260px、间距28px，阅读目录隐藏。≤760px 单列并折叠菜单，主题按钮在菜单外常驻；761–900px 搜索收为有无障碍名称的38px图标链接。≤480px 侧内边距20px、正文上下32px。阅读正文最大720px，目录220px、间距48px。间距以4px为基本单位，面板通常24px；发布面板24px / 20px。

## Elevation & Depth

使用平面填色、1px细边框与主题内的表面明度差表达层级，不添加阴影或渐变。交互颜色过渡为200ms ease；减少动态效果偏好关闭过渡与平滑滚动。首页装饰维持28%透明度，深色仅对其外层应用 `invert(1)` 与 `screen` 混合；原GPU组件参数和性能回退不变。

## Shapes

小键帽与行内代码用小圆角，按钮和输入框用按钮圆角，面板和卡片用卡片圆角，标签用胶囊圆角。具体值见前置 rounded。热力图保留紧凑日期格，不把装饰形状推广到内容容器。

## Components

- **主题切换：** 38px方形、细边框、月亮／太阳图标；悬停用局部浅底和强文字，焦点为2px语义蓝轮廓、偏移4px。按钮的 `aria-label`、title 与 `aria-pressed` 同步；无脚本隐藏。
- **主按钮：** 蓝底白字、14px中等字重、10px / 18px内边距；悬停使用对应主题的 button-hover。普通链接与次级操作沿用语义蓝或浅蓝底。
- **搜索：** 细边框、透明输入底、16px字、14px / 16px容器内边距；聚焦容器边框变蓝，保留可读标签。手机进一步收紧。
- **导航：** 14px，8px / 16px内边距；默认次文字、悬停局部浅底、当前项浅蓝底与语义蓝文字。
- **标签：** 浅蓝底与语义蓝文字、5px / 12px内边距；悬停实蓝白字。侧栏标签缩至12px、4px / 9px内边距。
- **面板：** 语义 surface、1px语义 line、24px内边距；发布面板、标签面板与阅读卡片共享相同层级。

[Base.astro](src/layouts/Base.astro) 在首屏绘制前读取 `localStorage['zanuain-theme']`；仅 `dark` 启用深色，缺失、无效值或读取异常均回浅色，不跟随系统偏好。切换同步根 `data-theme`、CSS `color-scheme` 与浏览器 `theme-color`；写入失败仍可当页切换，storage事件同步其他标签页，清除存储回浅色。[ThemeToggle.astro](src/components/ThemeToggle.astro) 负责交互。Shiki 静态输出 github-light / github-dark 双调色板，CSS切换，无客户端重新高亮。

关于页外层随主题切换，终端内景始终使用原参考调色板；切换不重建 React 终端，已有输入、历史和回显保留。装饰画布滤镜不得影响终端。六项可渲染原语见 [.impeccable/design.json](.impeccable/design.json)，完整行为以源码为准。

## Do's and Don'ts

### Do

- Do 使用 src/styles/themes.css 的语义变量适配页面、标签、图表和阅读内容。
- Do 保持默认纯白、显式选择、可见键盘焦点与手机常驻切换。
- Do 从公开 Markdown 计算内容统计；当前4篇公开笔记、7个标签只是记录快照。

### Don't

- Don't 改写 DESIGN/ 中的原始四份参考文件来实现主题。
- Don't 对终端或整页施加反色滤镜；滤镜只属于首页装饰 canvas 的外层。
- Don't 随系统偏好自动切换、重挂载终端，或添加阴影和渐变。
