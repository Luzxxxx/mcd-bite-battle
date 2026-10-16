# 麦麦点餐擂台 · Bite Battle Club

**同一袋餐，你能比 AI 点得更便宜吗？**

麦麦点餐擂台是一款基于麦当劳官方 MCP 的单人点餐策略对战应用。给定一份目标餐品，玩家和对手分别用单点、套餐等方式组餐，锁定餐单后翻牌比价。

内置策略对手支持直接试玩，接入自己的模型 API 后可与 AI 对战。真实门店模式读取官方菜单、拆解套餐并整单核价，让不同买法的价格差异有据可查。

面向喜欢研究点餐搭配的消费者、策略解谜玩家，以及希望演示 MCP 应用的开发者。

[下载源码](https://github.com/Luzxxxx/mcd-bite-battle/archive/refs/heads/main.zip) · [快速试玩](#快速试玩) · [使用说明](docs/USAGE.md) · [MCP 接入](MCP_INTEGRATION.md) · [验收记录](docs/RELEASE_CHECK.md)

![麦麦点餐擂台首页](docs/images/desktop.jpg)

## 核心机制

| 设计 | 实现与作用 |
| --- | --- |
| 比较相同餐品 | 逐项核对餐品、份数、规格和默认配料，餐品一致才比较价格。 |
| 使用官方报价 | 真实门店模式根据官方菜单与套餐详情生成餐单，以整单核价结果判定胜负。 |
| 复核对手方案 | 真实门店和模型训练对局在开局时封存对手方案，翻牌时通过 SHA-256 核对，并展示餐单与报价。 |

## 快速试玩

需要 [Node.js](https://nodejs.org/) **22.9 或更新版本**；本次验收使用 Node.js 24。训练场不用密钥，也不用安装依赖。

**Windows：** 下载仓库 ZIP 并完整解压，双击 `启动试玩.cmd`。服务就绪后会自动打开浏览器。

**终端启动：** 在包含本文件的目录运行：

```sh
node --env-file-if-exists=.env server.mjs
```

打开 <http://127.0.0.1:4318/>。游戏运行时保留启动窗口，停止按 Ctrl+C。端口被占用时，在本机 `.env` 设置 `PORT=4319`，再打开日志中的地址。请通过本机服务访问页面。

## 使用示例

以下金额为训练场的固定示例价。

目标是鸡肉堡、中薯、中杯可乐：

1. 加入「鸡肉堡薯条双拼」和「可乐（中）」。
2. 点击「锁定餐单」，再「翻牌」。
3. 玩家示例价 ¥25.90，策略对手 ¥29.90，省下 ¥4.00。

换成小薯会因餐品规格不同而无法锁定。完成这一局后，可切换题目或接入自己的模型对手。

## 功能与模式

| 模式 | 内容 | 数据与条件 |
| --- | --- | --- |
| 训练场 | 20 种餐品、37 种买法、8 道预设题、示例券和自由出题 | 虚构教学价格，无需密钥 |
| 真实门店 | 搜索营业门店，从完整菜单选择餐品开题，比较不同买法 | 官方 MCP 菜单与整单报价，需自己的 Token |

两种模式都可选择内置策略对手，或接入自己的模型 API。真实门店模式采用即时到店自取、默认配料，不使用账户优惠券。

支持手机操作、PNG 战绩卡导出，以及训练题目与成绩分享。好友可以独立完成同一道训练题，接收端会根据规则重新计算成绩。

分享使用当前页面地址。跨设备试玩需要双方各自启动项目并保留链接中的 `#challenge=...`，或另行部署可访问的网页。本机回环地址不能让远端朋友直接访问。

## 接入模型对手

点击对手卡「用自己的 AI」，选择服务，填写 Base URL、模型 ID 和 API Key，点击「开始对战」。

页面预设 DeepSeek、通义千问 / 百炼、硅基流动，也支持部署者允许的兼容域名。模型需支持工具调用。目前真实账户实测的是 DeepSeek；其他服务通过配置与协议测试，尚未逐家联调。

密钥只在页面内存和当前后端请求中使用，刷新或清除配置后移除，不进入分享链接、票据或战绩卡。请求经过运行本项目的后端，会消耗你的模型额度，请在可信部署中填写。

也可在本机 `.env` 设置 `DEEPSEEK_API_KEY` 与 `DEEPSEEK_MODEL`，使用弹窗里的本机快捷入口。更多配置见 [模型说明](docs/MODEL_INTEGRATION.md)。

![本机 DeepSeek 对战，金额为训练示例价](docs/images/deepseek-result.jpg)

## 接入真实门店

1. 按[官方 MCP 指南](https://github.com/M-China/mcd-mcp-server)取得自己的 Token。
2. 复制 `.env.example` 为 `.env`，在本机填写 `MCD_MCP_TOKEN`；已有配置时直接编辑。
3. 重启服务，点击右上角「演示训练场」→「检查本机接入」。
4. 搜索城市和地点，选择营业门店，再选菜单中的餐品开题。

实际使用 `query-nearby-stores`、`query-meals`、`query-meal-detail` 和 `calculate-price`：官方菜单决定可买什么，详情决定餐袋内容，整单报价决定胜负。完整调用流程见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。

当前采用即时到店自取、默认配料、不用账户券，只查询和核价。菜单随门店与时段变化；复杂选配无法精确拆解，或回执缺项时，会停止开局或判胜。

## 对手与判定规则

默认对手采用有范围限制的确定性策略算法。模型对手最多试算三次，并提交已完成报价核验的餐单。真实门店和模型训练对局在开局时封存方案，翻牌时通过 SHA-256 核对。

双方必须在相同规则下收到同一袋餐。少一份、换杯型、换默认特制都不能当作便宜；实付相同算平局。胜过当前对手不代表全菜单最低价。

## 验证与开发

不调用外部服务的检查：

```sh
node --test
node scripts/check.mjs
node scripts/check-release.mjs
node scripts/smoke.mjs
```

2026-10-16 验收：**45 项测试通过**；桌面、手机餐袋、自由题、分享与 PNG 导出已测，真实 DeepSeek 和官方 MCP 核价已跑通。价格是对应时间与门店的历史记录，详见 [验收报告](docs/RELEASE_CHECK.md)。

真实联调需先配置自己的凭据并启动服务，再运行：

```sh
node --env-file-if-exists=.env scripts/verify-v03.mjs
```

该脚本会消耗模型额度，有 MCP Token 时还会核价一个实时餐品。默认测试门店可能关闭或无货，届时可在页面另选门店。

本机版没有运行时依赖。可选托管训练版通过 `pnpm install --frozen-lockfile`、`pnpm build` 构建；部署者需提供自己的平台配置及 `ARENA_TICKET_KEY`。构建通过不等于公开网站验收通过。见 [架构与部署](docs/ARCHITECTURE.md)。

## 项目导航

| 位置 | 内容 |
| --- | --- |
| `web/` | 页面、训练规则与同题链接 |
| `lib/` | MCP 适配、餐袋映射、模型工具与对局票据 |
| `server.mjs`、`worker/` | 本机服务与可选托管训练入口 |
| `tests/`、`scripts/` | 测试、启动与联调脚本 |
| [Skill 入口](skills/mcd-bite-battle/SKILL.md) | 供 Agent 启动、解释和复现玩法，需保留完整项目 |
| [参与开发](CONTRIBUTING.md) | 开发与反馈说明 |
| [素材与参考](docs/ATTRIBUTION.md) | 代码、示意图、数据与构思来源 |

## 参赛说明

本项目是独立参赛作品，非麦当劳官方产品。训练价格与优惠券为虚构教学数据，真实价格和供应以官方当次结果为准。

已通过[报名申请 #809](https://github.com/M-China/mcd-developer-innovation-challenge/issues/809)参赛，官方账号 M-China-Official 于 2026-10-16 回复[“您的作品已成功参赛”](https://github.com/M-China/mcd-developer-innovation-challenge/issues/809#issuecomment-6216025358)。报名回执不代表最终排名或获奖审核结果。

按[官方比赛要求](https://github.com/M-China/mcd-developer-innovation-challenge)提供 `README.md`、原样 `CONTEST_DECLARATION.md`、`MCP_INTEGRATION.md`、仅含环境变量占位符的 `mcp-config.example.json` 和完整源码。未使用 WorkBuddy，未申报其专项奖励。材料对应与报名记录见 [提交说明](docs/SUBMISSION.md)。
