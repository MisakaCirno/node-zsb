# node-zsb

基于 Bun、Elysia、Konva、skia-canvas 和 sharp 的战术板图片渲染与可视化编辑服务。

项目统一使用 Bun 运行，不提供 Node.js 启动路径。当前开发和完整回归基线为 Bun 1.3.5；Windows 启动器不强制锁定补丁版本，部署机器可在构建和冒烟通过后使用同一 1.x 系列的较新补丁版本。Windows 部署基线为 Windows Server 2022 x64。

项目同时提供两类能力：

- 服务端 API：把战术板分享码或 JSON 渲染为 WebP 图片。
- 浏览器编辑器：通过可编辑画板创建、调整、分组、保存和导入导出战术板。

## 安装

```bash
bun install
```

部署机器应在本机执行依赖安装，以获取与操作系统和 CPU 架构匹配的 `sharp`、`skia-canvas` 原生模块。不要从其他平台复制 `node_modules`。

## 启动

生产/普通运行：

```bash
bun run start
```

Windows Server 生产环境使用仓库根目录的 `start_node_zsb.bat`。启动器会检查当前分支的远端更新，只接受快进更新，并在提交变化时自动安装锁定依赖、构建、冒烟后以前台方式启动服务。详细步骤见 [Windows Server 直接 Git 部署手册](docs/windows-server-deployment.md)。

开发 watch 模式：

```bash
bun run dev
```

服务默认监听：

```text
http://localhost:3000
```

可通过环境变量修改监听参数：

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `NODE_ZSB_HOST` | `localhost` | 服务监听主机；当前 Windows 生产环境会解析为 IPv6 回环 `[::1]` |
| `NODE_ZSB_PORT` | `3000` | 1 到 65535 的监听端口 |

编辑器入口：

```text
http://localhost:3000/editor
```

如果浏览器显示 `NOT_FOUND`，先确认访问的是 `/editor`，不是站点根路径 `/`。

## 编辑器能力

- 从对象面板按中文名称或别名搜索职业、机制、标记、形状和范围对象，并快速访问最近使用项。
- 直接在画布中拖拽、旋转、缩放对象；线段对象支持拖拽起点和终点。
- 通过属性面板编辑位置、大小、角度、颜色、透明度、文字、线段端点和范围参数。
- 支持图层选择、多选、Shift 范围选择、拖拽排序、隐藏、锁定、删除、置顶和置底。
- 支持编辑器内分组和嵌套组；导出分享码时会自动展平为游戏可用的纯净战术板。
- 支持撤销、重做、复制、粘贴、创建副本、键盘微调和自定义右键菜单。
- 支持本地文件系统：新建、打开、保存、另存为、重命名、删除和预览本地文件。
- 支持把选中对象或图层组保存为可重命名的本地预设，并通过点击或拖拽重复插入。
- 支持将本地文件和预设备份为版本化 JSON，并通过合并或替换方式恢复到其他浏览器。
- 支持导入/导出分享码，导入/导出编辑器工程 JSON，导出预览图片。
- 支持辅助网格、网格吸附、网格密度、网格透明度、画布适配和 25% 到 200% 缩放。
- 支持可见的未保存状态和“保存 / 不保存 / 取消”文档切换确认。
- 支持版本化浏览器草稿自动恢复，以及通过 URL `code` 参数导入分享码。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + S` | 保存当前本地文件 |
| `Ctrl/Cmd + Shift + S` | 另存为本地文件 |
| `Ctrl/Cmd + C` | 复制选中对象 |
| `Ctrl/Cmd + V` | 粘贴对象 |
| `Ctrl/Cmd + D` | 创建选中对象副本 |
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
| `Ctrl/Cmd + 滚轮` | 围绕鼠标位置缩放画布 |
| `Space + 左键拖拽` / `中键拖拽` | 平移画布视图 |

## 校验

类型检查：

```bash
bun run typecheck
```

单元测试：

```bash
bun run test:unit
```

端到端测试：

```bash
bun run test:e2e
```

Playwright headed 或 UI 模式：

```bash
bun run test:e2e:headed
bun run test:e2e:ui
```

构建完成后，可运行 Bun 服务冒烟测试。该测试覆盖生产静态资源、编辑器入口、直接 WebP 渲染、缓存渲染和预览读取：

```bash
bun run build
bun run test:smoke
```

## 架构

当前代码结构：

- `index.ts`：服务入口。
- `src/server`：API、图片渲染、静态资源读取和缓存。
- `src/web`：浏览器编辑器。
- `src/web/types`：前端共享类型。
- `src/shared`：前后端共享纯逻辑。
- `src/assets`：背景、对象贴图和字体素材。

更详细的模块边界、启动流程、渲染循环、项目 JSON 和扩展规则见 [docs/editor-architecture.md](docs/editor-architecture.md)。

## API

- `GET /board/:code?`：根据战术板分享码渲染 WebP 图片；未传 `code` 时渲染默认示例图。
- `POST /board/render`：渲染战术板并返回图片 `hash` 和 `thumbhash`。
- `GET /preview/:name`：根据 `hash` 读取缓存图片。
- `POST /utils/code2json`：战术板分享码转 JSON。
- `POST /utils/json2code`：战术板 JSON 转分享码。
- `GET /editor`：打开可编辑战术板画板。
- `GET /editor-data`：读取编辑器图标、背景和默认代码元数据。
- `GET /health/live`：返回轻量进程存活状态。

无效战术板分享码会返回 `400`，不会静默回退为默认图。

## 本地数据和缓存

- 浏览器自动恢复、编辑器设置和本地文件保存在浏览器 `localStorage` 中。
- 服务端渲染结果会写入项目根目录下的 `cache` 目录。
- `cache` 已在 `.gitignore` 中忽略。
