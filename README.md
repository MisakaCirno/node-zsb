# node-zsb

基于 Bun、Elysia、Konva、skia-canvas 和 sharp 的战术板图片渲染与可视化编辑服务。

## 安装

```bash
bun install
```

## 运行

```bash
bun run start
```

开发时可以使用 watch 模式：

```bash
bun run dev
```

服务默认监听 `http://localhost:3000`。

可编辑画板入口：

```text
http://localhost:3000/editor
```

## 编辑器能力

- 导入、导出战术板代码，并可渲染预览图。
- 通过图标面板添加职业、机制、标记、形状和范围对象。
- 在画布或属性面板中编辑对象位置、大小、角度、颜色、文字、线段端点和范围参数。
- 支持图层选择、上移、下移、隐藏、锁定、清空画板和对象数量显示。
- 支持撤销、重做、自动恢复上一次画板、本地存档槽和 URL 参数导入。
- 支持辅助网格、网格吸附、居中、画布适配和缩放。
- 线段对象可以直接拖拽起点和终点。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + C` | 复制选中对象到编辑器剪贴板 |
| `Ctrl/Cmd + V` | 粘贴对象 |
| `Ctrl/Cmd + D` | 快速复制选中对象 |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` | 重做 |
| `Ctrl/Cmd + Y` | 重做 |
| `Arrow` | 微调选中对象 1 格 |
| `Shift + Arrow` | 微调选中对象 10 格 |
| `Delete` / `Backspace` | 删除选中对象 |
| `Escape` | 取消选择 |
| `Ctrl/Cmd + +` | 放大画布 |
| `Ctrl/Cmd + -` | 缩小画布 |
| `Ctrl/Cmd + 0` | 适配画布视图 |

## 校验

```bash
bun run typecheck
```

```bash
bun run test:unit
```

```bash
bun run test:e2e
```

也可以使用 Playwright 的 headed 或 UI 模式：

```bash
bun run test:e2e:headed
bun run test:e2e:ui
```

## 架构

编辑器前端模块边界、启动流程、渲染循环和测试策略见 [docs/editor-architecture.md](docs/editor-architecture.md)。

## 接口

- `GET /board/:code?`：根据战术板代码渲染 webp 图片；未传 `code` 时渲染默认示例图。
- `POST /board/render`：渲染战术板并返回图片 `hash` 和 `thumbhash`。
- `GET /preview/:name`：根据 `hash` 读取缓存图片。
- `POST /utils/code2json`：战术板代码转 JSON。
- `POST /utils/json2code`：战术板 JSON 转代码。
- `GET /editor`：打开可编辑战术板画板。
- `GET /editor-data`：读取编辑器图标、背景和默认代码元数据。

无效战术板代码会返回 400，不再静默回退为默认图。

## 缓存

渲染结果会写入项目根目录下的 `cache` 目录。该目录已在 `.gitignore` 中忽略。
