# 编辑器架构说明

本文记录 `/editor` 可视化画板的前端模块边界，方便后续继续开发画板功能、渲染优化和本地存储能力。

## 入口与启动

- `src/web/app.ts` 是浏览器入口，只负责调用 `startEditorApp()` 并处理顶层异常。
- `src/web/editorApp.ts` 是应用启动器，负责创建共享状态、反馈、历史、上下文、舞台渲染器、业务控制器、事件动作表和渲染循环。
- `src/web/editorStartup.ts` 负责选择初始画板来源，优先级为：
  1. URL 查询参数 `code`
  2. 浏览器自动保存的上一次画板
  3. 服务端返回的默认代码

`editorApp.start()` 是幂等的。重复调用会复用同一个启动 Promise，避免重复绑定 DOM 事件；启动失败后允许再次重试。

## 状态与上下文

- `src/web/editorState.ts` 创建编辑器状态，包含当前画板、选中对象、图标数据、背景数据、缩放、历史、剪贴板和运行状态。
- `src/web/editorContext.ts` 暴露共享上下文 API：
  - `selectObject`
  - `deselect`
  - `getSelected`
  - `normalizePoint`
  - `normalizeCoordinate`

多个控制器都依赖这些 API，但不直接知道彼此的内部结构。

## 控制器装配

`src/web/editorControllers.ts` 集中创建业务控制器：

- `boardMetaControls`：画板名称和背景。
- `boardCodeActions`：代码导入、导出和预览渲染。
- `inspectorControls`：右侧属性面板。
- `localBoardsPanel`：浏览器本地存档槽。
- `objectCommands`：新增、删除、复制、移动、居中、粘贴和图层标记。
- `viewportControls`：缩放、适配、网格和吸附。

`src/web/editorActionRegistry.ts` 将这些控制器组装成事件绑定层需要的扁平 `actions` 对象。这样 `editorBindings.ts` 只关心 DOM 事件到 action 的映射，不关心 action 来自哪个控制器。

## 事件绑定

- `src/web/editorElements.ts` 集中查询 DOM 元素。
- `src/web/editorBindings.ts` 绑定按钮、选择框、输入框、窗口 resize 和键盘事件。
- `src/web/keyboardShortcuts.ts` 只处理快捷键到编辑器命令的映射。

当前事件绑定在启动时执行一次，依赖 `editorApp.start()` 的幂等保护避免重复绑定。

## 渲染与保存

`src/web/editorRenderLoop.ts` 负责完整刷新流程：

1. 渲染背景
2. 渲染网格
3. 渲染对象
4. 渲染图层面板
5. 渲染属性面板
6. 将清理后的画板写入浏览器自动保存

`renderAll()` 使用串行合并队列。若渲染尚未完成时再次触发刷新，只标记需要补渲染；当前渲染结束后会自动使用最新状态再渲染一轮。这个设计用于避免图片异步加载时旧渲染覆盖新状态。

浏览器自动保存由 `editorRenderLoop` 统一触发。任何只修改状态但不触发渲染的流程，都需要显式调用 `renderAll()` 或重新评估保存策略。

## 舞台渲染

`src/web/stageRenderer.ts` 封装 Konva 舞台：

- 背景层
- 网格层
- 对象层
- Transformer 层
- 对象拖拽、旋转、线段端点拖拽

它接收 `recordHistory`、`renderAll`、`renderInspector`、`renderLayers`、`selectObject` 等回调，因此不直接持有 UI 面板逻辑。

## 本地存储

- `src/web/storage.ts` 封装 `localStorage` 读写。
- 自动恢复使用 `STORAGE_KEY`。
- 本地存档槽使用 `LOCAL_BOARDS_KEY`，最多保留 `MAX_LOCAL_BOARDS` 个。
- `src/web/board.ts` 负责 normalize、clean 和按对象能力移除无效字段。

## 测试

- `bun run test:unit`：运行 Node 内置 test runner，覆盖纯逻辑模块。
- `bun run test:e2e`：运行 Playwright 端到端测试，覆盖编辑器主要用户流程。
- `playwright.config.ts` 忽略 `tests/unit`，避免 e2e 输出混入 Node TAP 单测结果。

新增功能时建议：

- 纯函数或无 DOM 的模块优先补单元测试。
- 涉及用户操作、画布渲染、localStorage、URL 参数和导入导出的流程补 e2e。
- 对异步渲染、保存和历史记录相关修改，至少覆盖一次刷新或撤销/重做路径。

## 扩展建议

- 新增编辑器命令时，优先放到已有控制器；若命令横跨多个领域，再考虑新增控制器。
- 新增 DOM 元素时，先补 `editorElements.ts`，再注入到对应控制器。
- 新增画布对象类型时，需要同时检查：
  - `board.ts` 的能力清理
  - `stageRenderer.ts` 的节点创建
  - `inspectorPanel.ts` 和 `inspectorControls.ts` 的字段显示与写入
  - `palettePanel.ts` 的分类展示
  - e2e 导入导出与属性编辑覆盖
- 不建议继续无目标拆分 `editorApp.ts`。当前更有价值的方向是补测试、优化渲染性能、完善移动端体验和增加画板本地工作流。
