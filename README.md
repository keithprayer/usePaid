# usePaid · PAID Observatory

UsePaid 中文监控面板。**GitHub Actions 负责后台采集，GitHub Pages 展示静态面板**，无需 Cloudflare、服务器或 API 密钥。

锁定 Solana Mint：`98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump`。

## 启用展示（首次一次）

1. 打开 [Settings → Pages](https://github.com/keithprayer/usePaid/settings/pages)。
2. 将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 打开 [Actions → PAID Monitor and Pages](https://github.com/keithprayer/usePaid/actions/workflows/monitor.yml)，点击 **Run workflow**。
4. `collect` job 采集并保存数据；`deploy` job 成功后，在运行页面的 `github-pages` environment 链接打开网站。

默认项目地址预计为 `https://keithprayer.github.io/usePaid/`；**以成功部署返回的 URL 为准**。如果配置了自定义域名，地址可能不同。

仓库目前是私有的，GitHub Pages 需要支持私有仓库 Pages 的套餐（个人账号通常需要 Pro）。仓库私有不代表 Pages 网站私有；网站访问范围由 Pages 配置决定。本项目不会修改仓库可见性。

若 Pages 未启用，后台采集仍可运行：运行摘要会展示数据源成功数、行情状态、历史记录数和阈值触发数，并提供 `paid-dashboard` artifact。下载解压后，用本地 HTTP 服务打开其中的 `index.html`（不要直接通过 `file://` 打开，否则浏览器可能禁止读取 JSON）。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 自动运行规则

工作流：`.github/workflows/monitor.yml`。

- **定时**：UTC 每小时第 7、22、37、52 分钟，计划每 15 分钟运行。
- **代码更新**：推送至 `main` 后运行；仅修改 README 不触发。
- **手动**：Actions 页面 `Run workflow`。
- **浏览器关闭**：不影响 Actions 采集和事件检测。
- **面板刷新**：只读取已发布的快照，不在浏览器中请求原始数据源，也不触发 Actions。

GitHub 定时任务可能延迟或因额度、权限、平台状态而暂停，不能当作精确定时服务。界面显示实际采集时间；默认超过 45 分钟标记过期，停止将旧数据用于当前阈值判断。私有仓库的 Actions 运行受账户分钟数额度影响。

## 数据与持久化

| 模块 | 来源 / 内容 |
| --- | --- |
| 行情与交易池 | Dexscreener，过滤精确 mint，按流动性选择主池 |
| 价格历史 | GeckoTerminal 小时 OHLCV，指定 PAID mint |
| 链上安全 | Rugcheck：权限、供应、大额账户与风险线索 |
| 基本面 | 官方文档、PAID 机制页、法律披露、Analytics |
| 团队职业资料 | RootData、CryptoRank 与可追溯公开项目链接 |
| 开发信息 | GitHub UsePaid 的公开仓库数与关注人数 |
| 后台事件 | 来源故障/恢复、文档变化、权限变化与阈值触发 |

每次运行从 **`monitor-data` 分支**读取上次的 `data/snapshot.json`，追加真实行情采样和事件，再通过普通非强制推送保存。不向 `main` 提交采集数据，后台任务不会形成推送触发循环。

默认快照保留最近 2,880 个有效行情采样（按 15 分钟约 30 天）和 300 条事件。Git 分支历史会继续保留旧提交。数据源失败时展示未知，不生成替代数字；页面变化只提示复核，不自动改写研究结论。公开页面的动态内容也可能导致指纹变化。

`monitor.config.json` 设置后台阈值：

```json
{
  "intervalMinutes": 15,
  "staleAfterMinutes": 45,
  "liquidityBelowUsd": 100000,
  "drop24hPercent": 20,
  "historyLimit": 2880,
  "eventLimit": 300
}
```

修改采集频率时，需要同时修改工作流中的 `schedule.cron` 和 `intervalMinutes`；后者是界面说明，不会改变 GitHub 的调度。

面板中的自定义提醒阈值与最多 100 条浏览器观察记录保存在当前浏览器 `localStorage`。这些设置不修改后台阈值。后台事件直接显示在“事件与动态”页面；没有邮件、Slack 或其他外部通知。

团队、产品机制、事件时间线和历史协议指标的研究基准为 **2026-10-12**。X 帖子、社区消息、完整员工名单、独立收入及用户统计尚未接入。项目自述和第三方报告不等于独立验证。团队档案仅包含与项目有关的公开职业信息。

## 本地开发和检查

需要 Node.js 22+，推荐 24。无应用依赖，不需要 `npm install`。

```bash
npm run collect  # 从公开来源采集一次；本地需要可用的外部网络
npm run dev      # http://127.0.0.1:8787
npm run check    # 构建、数据逻辑测试、Git 状态往返测试与静态站校验
npm run build    # 输出 dist/index.html 和 dist/data/snapshot.json
npm start        # 本地预览构建后的静态站
```

没有执行采集时，开发站明确显示“尚未采集”，不填充模拟行情。`data/snapshot.json` 与 `dist/` 不提交到源码分支。

## 文件结构

```text
.github/workflows/monitor.yml  定时采集、持久化、artifact 与 Pages 部署
monitor.config.json           后台阈值与保留上限
src/index.html                静态中文界面，使用相对路径读取 JSON
src/server.mjs                公开数据源采集函数（Actions 中执行）
scripts/collect.mjs           单次采集与 Actions 摘要
scripts/snapshot.mjs          历史、变化检测与后台阈值
scripts/state-git.mjs         monitor-data 分支持久化
scripts/build.mjs             生成 GitHub Pages 静态站
scripts/validate.mjs          路径、身份、前端语法与产物校验
tests/                        数据故障、变化检测和持久化测试
```

工作流仅使用内置 `GITHUB_TOKEN`：采集 job 请求 `contents: write` 保存数据分支；部署 job 请求 `pages: write` 与 `id-token: write`。不需要把任何 token 放进代码或网页。Pages 的首次启用需要仓库管理员在 Settings 中操作，普通工作流 token 无法自动完成这一步。
