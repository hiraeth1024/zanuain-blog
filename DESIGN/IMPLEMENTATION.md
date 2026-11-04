# 个人学习笔记站实现说明

本页记录既有 Notion 规范在当前静态站中的落地，不替代用户原始 [DESIGN.md](./DESIGN.md)、[variables.css](./variables.css)、[tokens.json](./tokens.json) 或 [theme.css](./theme.css)。产品范围见 [PRODUCT.md](../PRODUCT.md)，布局依据见 [site-layout.md](../.impeccable/site-layout.md)。

## 视觉来源与样式映射

当前实现延续既有视觉体系；结构按 Cube007 的内容站布局组织，排除所有工具模块。顶部导航、首页介绍与笔记流取代已撤销的应用式侧栏。

[Base.astro](../src/layouts/Base.astro) 加载 [global.css](../src/styles/global.css)，后者直接导入原始 `variables.css`；JSON 与 `@theme` 文件不参与运行时加载。用户明确要求默认白色背景，因此 `--canvas` 映射既有 `--color-pure-white`，不改写原有暖白 token。

`--blue` 使用 Notion Blue，`--muted` 使用 Graphite；正文为黑色 90% 透明度，分隔线为黑色 8% 透明度。暖白用于局部悬停、键帽和行内代码，淡蓝用于当前导航与标签。按钮圆角（8px）、面板与卡片圆角（12px）、胶囊标签和细边框均沿用原规范；无阴影、无渐变。

字体引用 `--font-notioninter` 的既有系统后备栈。源码没有加载或自托管 NotionInter、Lyon Text 商用字体文件，实际字形取决于设备字体。正文（16px）、说明（14px）、元信息（12px），文章行高（1.9）；首页站名桌面（96px）、常规页标题（40px）。

## 布局与组件

站点容器最大宽（1160px，含内边距），顶部导航最小高（66px），左右内边距（24px）；主内容上下内边距（48px）。首页介绍最小高为 `calc(100svh - 100px)`，下接左侧时间倒序笔记流、右侧标签面板（300px），列间距（40px）。[NoteList.astro](../src/components/NoteList.astro) 显示日期、阅读时间、摘要和标签；[TagList.astro](../src/components/TagList.astro) 显示真实标签数量。

阅读页 [notes/[...id].astro](../src/pages/notes/[...id].astro) 最大宽（988px）：正文在左（最大720px），黏性目录在右（220px），间距（48px）。正文下方相关笔记采用三列卡片网格，相邻笔记采用两列边框卡片。代码块、表格可独立横向滚动，图片不超出正文宽度。

| 视口条件 | 当前行为 |
| --- | --- |
| ≤1040px | 首页标签列收至260px、间距28px；文章隐藏目录，正文保持最大720px |
| ≤760px | 导航可折叠；首页笔记与标签单列；站名72px、文章标题32px |
| ≤480px | 页面左右内边距20px，主内容上下32px；日期移至笔记标题上方；相关与相邻笔记卡片单列；正文15px |

## 页面与交互

首页和关于页的统计来自内容集合；当前三篇是项目自带入门示例，首页明确说明其性质，不代表作者真实学习经历。[notes.ts](../src/lib/notes.ts) 过滤草稿并按日期倒序，标签页和独立标签目录复用同一内容来源。关于、RSS、写作及404页面均已实现，无工具入口或工具搜索结果。

[search.astro](../src/pages/search.astro) 独立搜索标题、摘要和标签，支持多关键词、URL `q` 参数、结果数量播报、空结果提示及清除；Escape 清空，`/` 与 Ctrl/⌘ K 聚焦或打开搜索。默认 HTML 提供全部笔记，无 JavaScript 仍可阅读、浏览标签和使用普通链接。

移动菜单提供展开状态、Escape 和点击外部关闭；无 JavaScript 时导航直接展开。站点提供跳到正文、可见焦点与表单标签，标签链接可用键盘访问。文章支持目录锚点、阅读进度和复制链接；复制失败显示地址栏操作提示。颜色过渡（200ms ease），减少动态效果偏好关闭过渡与平滑滚动。

[admin/index.astro](../src/pages/admin/index.astro) 默认显示 Markdown 写作指南；只有配置有效 `CONTENT_REPOSITORY` 后，才加载可选 Sveltia CMS 的 CDN 脚本与对应配置。公开阅读不依赖该 CDN。RSS 通过 [rss.xml.ts](../src/pages/rss.xml.ts) 构建，正式订阅地址由 `SITE_URL` 决定；未设置时使用本地地址，部署前需填写真实域名。

## 首页 Shape Waves 背景

按用户指定接入 [React Bits Shape Waves](https://reactbits.dev/backgrounds/shape-waves) 的 TypeScript + Tailwind 版本，保留官方 [ShapeWaves.tsx](../src/components/ShapeWaves.tsx) 源码及许可标识。[index.astro](../src/pages/index.astro) 原样保留用户提供的全部参数：白底、灰色混合形状、`</>` 文字遮罩、指针波纹和1.6秒入场。背景仅在首页以 `client:load` 挂载 React island；使用 `@astrojs/react@5.0.7`、`react@19.3.1` 与兼容组件API的 `vgpu@0.3.0`。

[shape-waves.css](../src/styles/shape-waves.css) 仅引入 Tailwind 4 的 theme 与 utilities，不加载 Preflight。装饰层绝对定位、首屏全宽、透明度（28%）、鼠标事件穿透；原有前景位置、布局模块和设计token保持不变。组件离屏或文档切入后台时停止持续动画，并尊重减少动态效果偏好；WebGPU或脚本不可用时保留白底与可读静态内容。许可文件 [react-bits-LICENSE.txt](../public/licenses/react-bits-LICENSE.txt) 随静态构建复制，无新增交付栅格图。

## 首页发布数据看板

依据用户澄清“收藏数据不需要”“这个是发布数据看板”，[index.astro](../src/pages/index.astro) 在首页标签面板下追加同宽看板。[PublicationDashboard.tsx](../src/components/PublicationDashboard.tsx) 通过 `client:load` 挂载；数据直接来自排除草稿的 `getNotes()`，仅传入公开 Markdown 笔记的标题、日期、分类和真实文章链接，无收藏接入、外部接口或虚构活动。当前三篇入门示例均属“使用指南”，日期为2026年11月1日至3日；首页原有示例说明保留。

[publications.ts](../src/lib/publications.ts) 按 `Asia/Shanghai` 归日，浏览器加载后更新今天。热力图显示截至所选周的十五周（105个日期格），每周日到周六、编号按该周周一的 ISO 周数；月历按月份显示四、五或六行。支持周／月翻页、回到今天、切换视图及日期选中；当前时段的下一页与未来日期禁用。点击日期显示当天真实文章链接或空提示；分类筛选同步更新格子、日期结果和所选周／月的篇数、活跃天数、最长连续发布天数，分类计数也随时段变化。连续天数按时段内有发布的不同日期计算，空时段三项统计均为零。无 JavaScript 时保留构建时的静态热力图与统计，并提示启用脚本后可切换视图和日期。

[publication-dashboard.css](../src/styles/publication-dashboard.css) 沿用既有白色面板、Notion Blue、淡蓝、细边框、面板圆角（12px）与按钮圆角（8px），面板内边距（24px／20px），与标签面板间距（24px）。移动端随首页侧栏改为单列；日期、选中和键盘焦点均有轮廓标识。独立审阅要求的唯一修正已落实：选中分类的淡蓝底改用既有 Charcoal 前景（#111111），保留蓝色边框。本扩展未改动原始四份设计文件、tokens 或 `.impeccable/design.json`，不建立新视觉体系。

## 关于页 TermFolio 终端

依据用户指定及方向契约的 `ABOUT TERMINAL`，[about.astro](../src/pages/about.astro) 将原“Zanuain / 关于这个站点”文档组件替换为 [AboutTerminal.tsx](../src/components/AboutTerminal.tsx)，以 `client:load` 挂载；白色页面、原导航、页标题、简介和页脚保留。接入前核对官方 `termfolio@2.1.5` 源码，其 React 16 peer 与旧版 transition、styled-components 依赖不适用于当前 React 19，因此采用本地 TypeScript 适配，不安装旧包；源码保留来源标识，[MIT 许可](../public/licenses/termfolio-LICENSE.txt) 随构建发布，README 已同步说明。

[about-terminal.css](../src/styles/about-terminal.css) 将深色限制在终端窗口内：复用 Charcoal 底色与 Sky Wash 链接／焦点，辅以局部浅灰正文、静音灰（#b0b0b0）和状态标签；最大宽（940px）、面板圆角（12px）、标题栏高（46px，≤480px 时42px），输出区固定高（桌面320px，≤760px 时340px）并独立滚动。输入行可见、有原生表单标签与执行按钮，提供常用命令和重新开始按钮，无自动抢焦点。这是用户授权的局部深色组件例外，沿用既有页面与圆角体系，不扩展为全站身份；原始四份 DESIGN 文件、全局 tokens 与 `.impeccable/design.json` 均未改写。

[terminal.ts](../src/lib/terminal.ts) 提供15项命令及别名；`about`、`stack`、`links` 保留本站事实，`notes`、`tags`、`search` 复用排除草稿的 `getNotes()` 数据和真实链接，不虚构作者经历或接入外部运行时。支持保留未提交草稿的↑↓历史、确定性 Tab 前缀补全、完整命令后 Tab 离开输入框、原生 Shift Tab、Ctrl L 清屏与 Esc 清空；保留浏览器文本编辑。历史和输出各最多100条，输入最多1000字符；回显通过 React 文本渲染，不执行系统命令。服务端输出简介和内容计数，无脚本时保留普通笔记、标签与 RSS 链接。

## 验证与边界

关于终端本轮验证记录：7项命令测试通过，覆盖公开数据／空集合、大小写与多关键词搜索、文本回显、导航白名单、别名／历史、确定性补全及上海时区；Astro 检查25个文件，0错误、0警告、0提示，最新构建17个HTML页面通过。变更目标检测仅运行一次，结果为 `[]`，hook 检查无遗留项。静态产物已核对：终端 island 只在关于页、首页不含该组件，简介与无脚本链接存在、许可已复制、旧文档组件已移除。当前内容为4篇公开笔记、7个标签，包含用户本轮加入的 DESIGN 笔记及“设计”“skills”标签；前文“三篇示例”等计数保留为历史快照，不据此覆盖用户内容。

生产预览已验证命令输入、按钮提交、Tab 与焦点离开、历史恢复草稿、真实文章链接、`open search`／`exit` 导航、重置、错误／空结果／未配置仓库、无脚本回退及标记文本回显（未生成图片节点）；320、390、760、1040、1440、1920px宽度均无横向溢出。十份最终QA截图位于 [.impeccable/review/terminal/](../.impeccable/review/terminal/)：`desktop.png`、`mobile.png`、`help-desktop.png`、`help-mobile.png`、`errors-desktop.png`、`clear-desktop.png`、`notes-mobile.png`、`search-desktop.png`、`long-narrow.png`、`no-js-desktop.png`，均为有效审阅证据，非交付栅格素材。独立完整 finish review 最终处置为 `ship`，未提出修正，范围仅限关于页组件；该审阅核对源码与截图，未独立重跑测试。本次文档核对产品与方向契约、源码、测试定义、README、许可、构建页数及桌面／移动／无脚本截图；未发现需要另行修复的既有视觉漂移，历史验证记录保留如下。

发布看板本轮验证：7项日期与统计测试通过，覆盖上海时区、闰日、跨月／年、四／五／六行月历、跨年周编号、连续发布及分类／空时段；Astro 检查23个文件，0错误、0警告、0提示，构建14个HTML页面通过。最终分类前景 CSS 修正后再次构建通过；本轮变更目标检测结果为 `[]`。静态产物已核对包含105个热力图日期格和无脚本提示。

浏览器已验证视图切换、周／月导航、回到今天、当前下一页及未来日期禁用、分类联动、日期文章链接和零统计空状态；320、390、760、1040、1440、1920px宽度均无横向溢出。七份最终QA截图位于 [.impeccable/review/publications/](../.impeccable/review/publications/)：`heatmap-desktop.png`、`calendar-desktop.png`、`heatmap-mobile.png`、`calendar-mobile.png`、`empty-desktop.png`、`selected-desktop.png`、`panel-heatmap.png`，均已确认有效，不是站点交付素材。独立完整审阅保留视觉忠实度、功能与质量上限判断；所提选中分类文字对比度（原4.05:1）单项修正已解决，最终处置为 `ship`，仅适用于本次发布看板，不代表重新认证全站。文档核对了产品、方向契约、实现、测试、静态产物及截图文件；README 已同步说明背景与发布看板两个 React 挂载点，未发现本次需另行记录的既有漂移。此前验证记录保留如下。

首页背景本轮验证：Astro 检查20个文件，0错误、0警告、0提示，构建14个HTML页面通过；三份UI文件检测结果为空。真实GPU就绪且无错误，桌面（1440×900）、移动（390×844）、悬停、减少动态效果和无WebGPU五份截图均有效；移动无横向溢出，浏览按钮命中 `#feed`，菜单正常。完全离屏与减少动态效果时RAF计数分别保持2378、120不变；无WebGPU时画布透明、三条内容链接仍可使用。静态产物仅首页含背景island，关于页无canvas，许可文件存在；独立审阅结论为 `ship`，无实质修正，范围仅限本次首页背景。

此前内容站验证记录：Astro 检查19个文件，0错误、0警告、0提示；静态构建生成14个HTML页面及RSS、CMS配置。七类路由在桌面（1440×900）与移动（390×844）检查白色画布及横向溢出；搜索、复制、目录、标签键盘访问和移动菜单已检查。仅通过 `.env` 设置域名的RSS构建测试通过。

此前独立初审提出正文／目录左右关系与相关／翻页卡片两项实质修正；修正后两项均确认解决，限定该复核范围的结论为 `ship`，不据此声称重新完成全站认证。该轮16个截图文件已逐一打开确认有效，仅用于QA；交付没有设计栅格图。

尚未进行真实CMS认证或服务器部署。上述记录不代表完整浏览器兼容性或无障碍认证；用户原始四份设计参考文件均保留。


## 全局浅色／深色主题（2026-11-03）

依据 `GLOBAL THEMES` 方向契约和用户明确授权，在 [themes.css](../src/styles/themes.css) 增加语义颜色，所有页面与发布图表共用；默认纯白、不跟随系统偏好。浅色正文链接为更深的语义蓝，实心按钮保留原 Notion Blue；深色使用炭灰画布、分层灰面、浅色文字及浅蓝链接。原始四份 DESIGN 参考、用户笔记和终端局部色板均未改写。根 [DESIGN.md](../DESIGN.md) 记录实际 light/dark token、排版与组件；新增 [.impeccable/design.json](../.impeccable/design.json) schemaVersion 2，以六个可渲染原语承载扩展元数据。本节是追加的当前记录，前文描述保留为历史快照。

[Base.astro](../src/layouts/Base.astro) 在绘制前读取 `zanuain-theme`，只接受 `dark`；无值、无效值或读取异常默认浅色。[ThemeToggle.astro](../src/components/ThemeToggle.astro) 同步根 data-theme、color-scheme、浏览器 theme-color、按钮图标／名称／按下状态；写入失败仍可当页切换，storage事件同步其他标签页，清除存储回浅色。手机按钮在折叠菜单外常驻；761–900px 搜索压缩为有标签的38px图标链接。Shiki 构建时提供 github-light / github-dark 双调色板，无客户端重新高亮；首页只对装饰 canvas 外层反色与混合，不修改GPU组件参数。关于外层随主题切换，终端内部颜色、字体、焦点和已有输入／历史／回显保持。

验证来源为 [validation.md](../.impeccable/review/themes/validation.md)：Astro 检查27个文件，0错误／警告／提示；构建17个静态页；发布与终端14项测试通过；六个变更UI目标的 [detector.json](../.impeccable/review/themes/detector.json) 为 `[]`。浏览器覆盖默认白色（含系统深色偏好）、键盘切换、重载／导航恢复、真实跨标签页同步、读写存储异常、多页面与图表切换；320、390、760、761、780、820、900、901、1440px无文档溢出，终端同一实例的输入／回显和计算样式跨主题保持。当前公开内容4篇、7个标签，未改动用户笔记。

最终有效QA截图位于 [.impeccable/review/themes/](../.impeccable/review/themes/)：`home-light.png`、`home-dark.png`、`mobile-light.png`、`mobile-dark.png`、`mobile-calendar-dark.png`、`tablet-dark.png`、`article-dark.png`、`about-dark.png`、`about-light-stable.png`、`terminal-light-detail.png`、`terminal-dark-detail.png`。这些是浏览器原生QA证据，非站点交付图片；目录中的其他截图视为中间记录。独立完整finish review处置为 **SHIP**，无实质修正；本次文档整理依据已有验证记录与最终审阅，未重新运行浏览器或扩大认证范围。未部署或发布。

## 404 FuzzyText（2026-11-03）

依据方向契约 `NOT FOUND`，[404.astro](../src/pages/404.astro) 在既有文案与全站布局中增加单色动态 `404`、首页及搜索恢复入口。[FuzzyText.tsx](../src/components/FuzzyText.tsx) 来自 [React Bits 官方 TS + Tailwind 注册表](https://reactbits.dev/r/FuzzyText-TS-TW.json)，复用现有 React，无新增依赖或 shadcn 脚手架；保留源码署名与 [MIT + Commons Clause 许可](../public/licenses/react-bits-LICENSE.txt)。[NotFoundCode.tsx](../src/components/NotFoundCode.tsx) 在 React 内传入字符串 `404`，避免 Astro slot 变成 HTML 元素后被字符串化。全部指定参数为：`fontSize="inherit"`、`fontWeight={700}`、`color="currentColor"`、`colorSplit={0}`、`trigger="hover"`、`direction="horizontal"`、`baseIntensity={0.2}`、`hoverIntensity={0.5}`、`fuzzRange={30}`、`sliceSize={1}`、`fps={60}`、`transitionDuration={0}`、`intro={true}`、`introDuration={1400}`、`letterSpacing={0}`、`enableHover={true}`、`clickEffect={false}`、`glitchMode={false}`、`glitchInterval={2000}`、`glitchDuration={200}`。

[not-found.css](../src/styles/not-found.css) 复用系统字体、语义 `--strong` 与既有按钮；`currentColor` 随浅深主题重绘，无彩色分裂。局部源码适配仅增加画布就绪标记与实时减少动态效果响应：初始化完成前、无脚本或 Canvas 不可用时静态文字可见；减少动态效果时显示无模糊静态文字，恢复偏好后沿用动画。装饰区域对辅助技术隐藏，标题保留可读 `404`。构建生成 `dist/404.html`；开发环境与构建后静态预览中，实际不存在的地址均返回 HTTP 404 和自定义页面，现有 [nginx.conf](../deploy/nginx.conf) 的 `error_page 404 /404.html` 保留，尚未部署验证。

验证沿用 [validation.md](../.impeccable/review/not-found/validation.md)：Astro 检查29个文件，0错误／警告／提示，构建17个静态页；320、375、390、760、820、1440、1920px无横向溢出，首页／搜索恢复链接、浅深重绘、无脚本及实时减少动态效果通过；加载前注入 Canvas2D 不可用后，hydration 完成且静态 `404` 仍可见。原生画布在入场后测得常态横向偏移47–53px、悬停43–57px，确认模糊增强。六份有效截图位于 [.impeccable/review/not-found/](../.impeccable/review/not-found/)；独立完整 finish review 为 **SHIP**，无修正。本节依据已有验证与审阅追加，未重跑浏览器或扩大审阅范围。

此为既有页面与组件原语的局部延伸，无新视觉身份或设计系统；原始四份 DESIGN 参考、根 `DESIGN.md`、`.impeccable/design.json` 与用户笔记均保持原样。根设计文档因先前首页布局更新而比 sidecar 更新的时间戳漂移已知，本轮仅记录，不修复或重生成 sidecar。
