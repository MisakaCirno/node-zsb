# Windows Server 直接 Git 部署手册

本文适用于当前单台 Windows Server 2022、低流量、允许停服维护的部署方式。线上仓库直接更新，不创建 release 目录，也不自动备份代码或缓存。

当前生产拓扑：

```text
Internet
  -> Nginx /n/
  -> http://[::1]:3000/
  -> node-zsb
```

Nginx 的 `proxy_pass http://[::1]:3000/;` 会去掉 `/n/` 前缀。只要启动器继续使用默认的 `localhost:3000`，部署时不需要修改 Nginx。

编辑器会根据浏览器中的 `/n/editor` 地址自动为脚本、素材、API 和预览请求保留 `/n` 前缀；公网入口固定为：

```text
https://ff14hub.com/n/editor
```

## 启动器行为

双击仓库根目录的 `start_node_zsb.bat` 后，启动器会：

1. 检查 Git、Bun、监听端口和受跟踪文件状态。
2. 保留所有未跟踪和已忽略的服务器本地文件。
3. 获取当前分支的上游更新。
4. 仅在本地提交是上游祖先时执行 `--ff-only` 快进。
5. 在提交变化、依赖缺失或构建产物缺失时执行：
   - `bun install --frozen-lockfile`
   - `bun run build`
   - `bun run test:smoke`
6. 设置生产环境并以前台方式执行 `bun run start`。

准备成功的 commit 和 Bun 版本会记录在已忽略的 `.node-zsb-runtime/prepared-state` 中。相同 commit 和 Bun 版本下次启动时不会重复安装、构建和冒烟；更换 Bun 版本后会自动重新准备。

以下情况会停止，不会强行覆盖或启动：

- 3000 端口已被占用；
- 受 Git 跟踪的文件存在本地修改；
- 本地分支领先上游或与上游分叉；
- 依赖安装、构建或冒烟失败。

如果 GitHub 暂时无法访问，启动器会保留当前 checkout；已经准备好的版本仍可启动。未准备版本仍会尝试使用本机现有依赖完成准备。

## 首次切换

服务器当前目录：

```text
C:\Users\Administrator\Desktop\srv\node-zsb
```

首次取得新版启动器前，需要在管理员 PowerShell 中执行一次人工快进：

```powershell
Set-Location C:\Users\Administrator\Desktop\srv\node-zsb
git status --short --branch
git fetch origin
git merge --ff-only origin/winserver_node
```

`git status` 可以显示旧的 `bun_start.bat`、`node_start.bat` 和 `package-lock.json`；新版 `.gitignore` 会忽略这些服务器遗留文件，更新不会删除它们。

然后：

1. 关闭旧 `bun_start.bat` 窗口，确认旧 Bun 进程退出。
2. 双击 `start_node_zsb.bat`。
3. 等待依赖安装、构建和冒烟完成。
4. 保持启动器窗口打开。

不要在旧进程仍监听 3000 端口时更新。启动器也会主动拒绝这种操作。

## 日常更新和启动

以后每次维护只需：

1. 在旧启动器窗口按 `Ctrl+C` 停止服务。
2. 再次双击 `start_node_zsb.bat`。
3. 等待自动检查更新并启动。

没有远端更新且当前 commit 已准备完成时，启动器会直接启动，不重复构建。

项目的回归基线是 Bun 1.3.5。启动器只显示实际 Bun 版本，不因服务器使用 1.3.9 等同一主版本补丁而阻止启动；能否上线以锁定依赖安装、构建和生产冒烟结果为准。

## 上线检查

启动器显示以下信息后，服务已进入前台运行：

```text
[START] Starting node-zsb at http://localhost:3000
Server running at http://localhost:3000
```

另开一个 PowerShell 窗口执行：

```powershell
Invoke-RestMethod 'http://[::1]:3000/health/live'
Invoke-RestMethod 'https://ff14hub.com/n/health/live'

$response = Invoke-WebRequest 'https://ff14hub.com/n/board' -UseBasicParsing
$response.StatusCode
$response.Headers['Content-Type']
```

预期：

- 两个健康检查均返回 `status = ok`；
- 公网 `/n/board` 返回 `200`；
- `Content-Type` 包含 `image/webp`；
- `https://ff14hub.com/n/editor` 可以打开编辑器。

## 停止和故障处理

在启动器窗口按 `Ctrl+C` 即可停止服务。当前部署不注册 Windows 服务或计划任务，服务器重启和用户退出后需要人工重新双击启动器。

更新或构建失败时保持停服，先阅读窗口中的第一条 `[ERROR]`。启动器不会执行 `git reset --hard`、`git clean`、自动 stash、进程强杀或 Nginx 重载。

如果新版本启动后必须临时恢复原版本，可利用 Git 中仍然存在的旧提交和服务器保留的旧 `bun_start.bat`：

```powershell
git switch --detach 7289fd61288fc8ab5f566cac92d67fe9b3616954
bun install --frozen-lockfile
```

然后双击未跟踪的旧 `bun_start.bat`。恢复新版时停止旧进程并执行：

```powershell
git switch winserver_node
powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File .\ops\windows\Start-NodeZsb.ps1 `
    -SkipUpdate `
    -PrepareOnly `
    -ForcePrepare
```

再双击 `start_node_zsb.bat`。不要在有受跟踪文件修改时切换提交。

服务端渲染缓存继续位于仓库根目录的 `cache`。直接在同一仓库更新不会删除当前缓存；Git 和启动器都不会清理它。
