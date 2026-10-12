# usePaid · PAID Observatory

UsePaid 项目中文监控面板：行情、链上安全线索、产品基本面、团队公开职业资料、事件、风险提醒和来源状态。

锁定 Solana Mint：`98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump`。同名代币不会自动纳入。

## 本地运行

需要 Node.js 22 或更高版本，推荐 Node.js 24。项目无应用依赖，本地运行、构建和测试不需要安装包。

```bash
git clone https://github.com/keithprayer/usePaid.git
cd usePaid
npm run dev
```

打开 `http://127.0.0.1:8787`。前端修改后刷新页面；后端修改自动重启。

```bash
npm run check    # 构建、测试与 Worker/前端语法校验
npm run build    # 生成 dist/server/index.js
npm start        # 本地运行构建后的版本
```

默认监听 `127.0.0.1:8787`。Node 部署时可通过 `HOST` 和 `PORT` 环境变量修改监听地址与端口。

## 由你发布

代码不包含自动部署工作流；推送到此仓库不会由本项目触发发布。

### Cloudflare Workers

仓库已包含 `wrangler.jsonc`，无需数据库或 API 密钥：

```bash
npx wrangler@4 login
npm run deploy
```

`deploy` 会按需下载 Wrangler 4 并部署到你登录的 Cloudflare 账号。可先修改 `wrangler.jsonc` 中的 `name`。也可在 Cloudflare 控制台导入此 GitHub 仓库：构建命令为 `npm run build`，部署命令为 `npx wrangler@4 deploy`，入口由配置指定。

该独立版本没有登录系统。部署后的访问范围由你的托管配置决定；若只给自己使用，可在 Cloudflare 配置 Access。私有 GitHub 仓库本身不会限制网站访客。

### Node.js 主机

执行 `npm run build`，以 `npm start` 启动；托管环境设置 `HOST=0.0.0.0` 与所需 `PORT`。需要出站 HTTPS 访问下面的数据源。**不能直接用 GitHub Pages 托管**，因为 `/api/*` 需要服务端处理。

## 功能与数据

| 模块 | 内容 / 来源 |
| --- | --- |
| 行情与交易池 | Dexscreener；按流动性选主池，展示价格、市值、FDV、成交量、买卖笔数 |
| 价格图表 | GeckoTerminal 小时 OHLCV；明确指定 PAID mint |
| 链上安全 | Rugcheck 报告；增发/冻结权限、供应、大额账户、风险项 |
| 产品与机制 | 官方文档、PAID 机制页、法律披露、Analytics |
| 团队档案 | RootData、CryptoRank 与可追溯公开项目链接 |
| 开发资料 | GitHub UsePaid 公开仓库数量与关注人数 |
| 风险监控 | 流动性/跌幅阈值、权限变化、公开文档指纹变化 |
| 导出 | JSON 快照，包含来源、时间与当前浏览器观察记录 |

默认在页面可见时每 3 分钟刷新，可改为 60 秒、5 分钟或仅手动。**关闭页面后停止检查，没有后台定时任务、邮件或社交通知。** 阈值、内容基准和最多 100 条观察记录保存在当前浏览器 `localStorage`；不跨设备同步。

团队、机制、事件与历史协议指标的研究基准为 **2026-10-12**，在界面中与自动刷新数据分开。文档变化只提示重新核验，不自动把旧研究结论改写成新事实。

X 帖子、Telegram/Discord 消息、完整员工名单、独立收入与用户指标尚未接入。没有可靠数据时显示未知；第三方 API 可能限流、阻止访问或改变结构。请求时间不等于链上报告生成时间。

项目自述、第三方收录与独立验证是不同证据等级。官网回购预算不代表已执行销毁，费用总额不等于项目收入，大额账户不自动归属团队。团队档案仅纳入与项目有关的公开职业信息。本站与 UsePaid 无隶属关系。

## 代码结构

```text
src/index.html          中文界面、图表、阈值与本地观察记录
src/server.mjs          固定公开来源、校验、超时、API 与 Worker 路由
scripts/build.mjs      将 HTML 与服务端合成独立 Worker
scripts/dev.mjs        本地开发入口
scripts/serve.mjs      Node 生产入口
scripts/http.mjs       Node HTTP 适配器
scripts/validate.mjs   构建结果与界面脚本校验
tests/                 数据身份与失败处理测试
wrangler.jsonc         手动发布配置
```

修改 `src/`，然后重新构建；`dist/` 为生成文件，不提交。无需 ChatGPT Sites 项目身份、平台令牌或私有凭证。
