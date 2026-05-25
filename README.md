# node-zsb

基于 Bun、Elysia、Konva、skia-canvas 和 sharp 的战术板图片渲染服务。

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

## 校验

```bash
bun run typecheck
```

## 接口

- `GET /board/:code?`：根据战术板代码渲染 webp 图片；未传 code 时渲染默认示例图。
- `POST /board/render`：渲染战术板并返回图片 hash 和 thumbhash。
- `GET /preview/:name`：根据 hash 读取缓存图片。
- `POST /utils/code2json`：战术板代码转 JSON。
- `POST /utils/json2code`：战术板 JSON 转代码。

无效战术板代码会返回 400，不再静默回退为默认图。

## 缓存

渲染结果会写入项目根目录下的 `cache` 目录。该目录已在 `.gitignore` 中忽略。
