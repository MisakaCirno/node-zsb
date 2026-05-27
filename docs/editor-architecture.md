# 编辑器架构说明

本文记录 `/editor` 可视化画板和图片渲染服务的当前模块边界。目标是让后续新增画板工具、分组能力、本地文件系统、导入导出和站点集成时，有明确的放置位置和检查清单。

## 顶层结构

- `index.ts`：服务入口，组装 Elysia 应用和服务端控制器。
- `src/server`：服务端代码，负责 HTTP API、战术板图片渲染、资源读取和图片缓存。
- `src/web`：浏览器端编辑器，负责画板 UI、Konva 舞台、交互控制器、本地文件和导入导出。
- `src/web/types`：前端共享类型，按业务领域拆分为 `board`、`layers`、`editor`、`actions` 和 `project`。
- `src/shared`：前后端共享的纯逻辑，目前主要是战术板几何计算。
- `src/assets`：背景、对象贴图和字体等静态素材。
- `tests/unit`：纯逻辑单元测试。
- `tests/editor.spec.ts`：Playwright 端到端测试，覆盖编辑器主要用户流程。

## TypeScript 配置

- `tsconfig.base.json`：公共严格类型规则。
- `tsconfig.server.json`：服务端检查，包含 `index.ts`、`src/server` 和 `src/shared`，使用 Node 类型。
- `tsconfig.web.json`：前端检查，包含 `src/web` 和 `src/shared`，使用 DOM 类型。
- `tsconfig.tests.json`：测试配置，包含 Playwright 配置和 E2E 测试。

`bun run typecheck` 会依次运行三套配置。新增跨环境文件时，需要确认它应属于 `server`、`web`、`shared` 还是测试配置。

## 服务端边界

`src/server/controllers` 负责 HTTP 路由处理：

- `imageController.ts`：战术板图片渲染相关 API。
- `utilsController.ts`：代码和 JSON 互转工具 API。
- `webController.ts`：编辑器页面、前端模块和编辑器元数据。

`src/server/renderer` 负责服务端图片渲染。它可以使用 `src/shared` 的纯几何逻辑，但不应依赖 `src/web`。

`src/server/utils` 负责服务端辅助逻辑，例如：

- 战术板代码解析和编码。
- 图标配置和静态资源路径。
- 图片加载、尺寸常量和缓存写入。

服务端新增功能时优先判断：

- 新 API 放到对应 controller。
- 渲染流程或图片节点生成放到 renderer。
- 资源、编码、缓存等可复用辅助逻辑放到 utils。
- 前后端都需要且不依赖运行环境的逻辑放到 `src/shared`。

## 前端启动流程

- `src/web/app.ts` 是浏览器入口，只负责调用 `startEditorApp()` 并处理顶层异常。
- `src/web/editorApp.ts` 是应用启动器，负责创建共享状态、反馈、历史、上下文、舞台渲染器、业务控制器、事件动作表和渲染循环。
- `src/web/editorStartup.ts` 负责选择初始画板来源，优先级为：
  1. URL 查询参数 `code`
  2. 浏览器自动保存的上一份项目
  3. 服务端返回的默认代码

`editorApp.start()` 是幂等的。重复调用会复用同一个启动 Promise，避免重复绑定 DOM 事件；启动失败后允许再次重试。

## 状态与上下文

- `src/web/editorState.ts` 创建编辑器状态，包含当前画板、图层树、选中项、图标数据、背景数据、视图设置、历史、剪贴板和运行状态。
- `src/web/editorContext.ts` 暴露共享上下文 API，例如选择对象、选择组、读取当前选择、吸附坐标和规范化坐标。

多个控制器都依赖这些 API，但不直接知道彼此的内部结构。

## 控制器装配

`src/web/editorControllers.ts` 集中创建业务控制器：

- `boardMetaControls`：分享名和背景。
- `boardCodeActions`：分享码导入、导出和预览图片渲染。
- `projectFileActions`：编辑器工程 JSON 的导入和导出。
- `inspectorControls`：右侧属性面板。
- `localBoardsPanel`：浏览器本地文件系统。
- `objectCommands`：新增、删除、复制、粘贴、移动、对齐、分组、解组和图层标记。
- `viewportControls`：缩放、适配、网格和吸附。

`src/web/editorActionRegistry.ts` 将这些控制器组装成事件绑定层需要的扁平 `actions` 对象。这样 `editorBindings.ts` 只关心 DOM 事件到 action 的映射，不关心 action 来自哪个控制器。

## 浏览器边界

- `src/web/browser.ts` 集中提供 `window`、`document`、`navigator` 和 `localStorage` 的访问入口。
- `src/web/editorElements.ts` 集中查询 DOM 元素，并校验具体 HTML 元素类型。
- `src/web/editorBindings.ts` 绑定按钮、输入、菜单、拖拽、右键菜单、窗口 resize 和键盘事件。
- `src/web/keyboardShortcuts.ts` 只处理快捷键到编辑器命令的映射。

新增 DOM 元素时，先补 `editorElements.ts` 的类型和查询，再注入到对应控制器或事件绑定层。不要在业务控制器里散落新的 `document.querySelector`。

## 渲染与保存

`src/web/editorRenderLoop.ts` 负责完整刷新流程：

1. 渲染背景
2. 渲染网格
3. 渲染对象
4. 渲染图层面板
5. 渲染属性面板
6. 将编辑器项目写入浏览器自动保存

`renderAll()` 使用串行合并队列。若渲染尚未完成时再次触发刷新，只标记需要补渲染；当前渲染结束后会自动使用最新状态再渲染一轮。

浏览器自动保存由 `editorRenderLoop` 统一触发。任何只修改状态但不触发渲染的流程，都需要显式调用 `renderAll()` 或重新评估保存策略。

## 舞台渲染

`src/web/stageRenderer.ts` 封装 Konva 舞台：

- 背景层
- 网格层
- 对象层
- Transformer 层
- 框选层
- 对象拖拽、缩放、旋转和线段端点拖拽

它接收 `recordHistory`、`renderAll`、`renderInspector`、`renderLayers`、`selectObject` 等回调，因此不直接持有 UI 面板逻辑。

## 本地文件与项目格式

- `src/web/storage.ts` 封装 localStorage 读写。
- 自动恢复使用 `STORAGE_KEY`。
- 本地文件列表使用 `LOCAL_FILES_KEY`，保留文件名、项目 JSON、纯净战术板、创建/更新时间和预览图。
- `src/web/project.ts` 负责编辑器项目格式。项目 JSON 可以保留编辑器专属信息，例如嵌套组。
- `createPureBoardFromProject()` 和 `flattenProjectToBoard()` 负责导出给游戏使用的纯净战术板结构。

编辑器项目格式和游戏分享码是两种不同边界：

- 工程 JSON 用于编辑器继续编辑和后续扩展。
- 分享码用于游戏或现有战术板渲染链路，导出时必须展平编辑器专属结构。

## 共享类型

`src/web/types.ts` 是兼容门面，只做 type-only re-export。新的类型应优先放入：

- `src/web/types/board.ts`：战术板、对象、图标、几何边界和对象能力。
- `src/web/types/layers.ts`：对象图层、组图层、图层引用和图层标记。
- `src/web/types/editor.ts`：编辑器状态、视图设置、上下文、基础 DOM-like 控件接口和视图控制器。
- `src/web/types/actions.ts`：控制器接口和事件动作表。
- `src/web/types/project.ts`：工程文件、本地文件和文件导入抽象。

如果某个类型只被一个模块使用，优先留在模块本地。只有跨模块复用时再提升到 `src/web/types`。

## 测试策略

- `bun run typecheck`：运行 server、web 和 tests 三套 TypeScript 配置。
- `bun run test:unit`：运行 Bun test，覆盖纯逻辑模块。
- `bun run test:e2e`：运行 Playwright 端到端测试，覆盖编辑器主要用户流程。
- `playwright.config.ts` 忽略 `tests/unit`，避免 E2E 输出混入 Node TAP 单测结果。

新增功能时建议：

- 纯函数或无 DOM 的模块优先补单元测试。
- 涉及用户操作、画布渲染、localStorage、URL 参数、导入导出和文件对话框的流程补 E2E。
- 对异步渲染、保存和历史记录相关修改，至少覆盖一次刷新或撤销/重做路径。

## 扩展放置规则

- 新增编辑器命令：优先放到已有控制器；若命令横跨多个领域，再考虑新增控制器。
- 新增画布工具：交互落在 `stageRenderer.ts` 或专门的舞台工具模块，命令仍通过 `objectCommands` 或新的控制器进入状态层。
- 新增对象类型：同时检查 `board.ts`、`stageRenderer.ts`、`inspectorPanel.ts`、`inspectorControls.ts`、`palettePanel.ts` 和 E2E 覆盖。
- 新增分组能力：优先检查 `layerTree.ts`、`layersPanel.ts`、`objectCommands.ts`、`project.ts` 和项目 JSON 展平逻辑。
- 新增本地文件能力：优先检查 `storage.ts`、`localBoardsPanel.ts`、`project.ts` 和保存前 dirty 检测。
- 新增前后端共享算法：只有在不依赖 DOM、Konva、Bun、Elysia、文件系统时，才放到 `src/shared`。

不建议继续无目标拆分 `editorApp.ts`。当前更有价值的方向是补测试、优化渲染性能、完善移动端体验和打磨本地文件工作流。
