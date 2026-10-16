# 架构与部署

## 本机版

```text
浏览器 → server.mjs → 训练规则 / 模型工具
                   → LiveArena → 官方 MCP
```

没有运行时依赖、数据库或账户注册。Node 只监听 127.0.0.1，检查 Host 和 Origin，不对局域网开放。训练策略和规则在浏览器运行；自带 API 的模型训练由本机后端准备并签发加密票据。真实局由后端保存门店、餐袋和方案，约十五分钟失效，重启后重开。

模型可调用受限的 `quote_plan` 和 `submit_plan`，最多三次试算；提交必须与先前有效报价的餐单一致。开局给出 SHA-256 承诺，翻牌返回原方案与 nonce，由前端复核。算法策略有明确搜索范围，不代表全局最低价。

## 配置

| 变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `PORT` | 本机端口，默认 4318 | 否 |
| `MCD_MCP_TOKEN` | 官方门店菜单与核价 | 仅真实局 |
| `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 本机模型快捷入口 | 否；也可在页面填自己的 API |
| `MODEL_API_ALLOWED_HOSTS` | 增加可信的模型接口域名，逗号分隔 | 否 |
| `ARENA_TICKET_KEY` | 32 字节随机密钥的 base64url 编码，43 字符 | 托管模型训练必需；本机未设置会随机生成 |

票据不保存 API Key。配置只从本机环境或页面明确填写的请求读取；不会读取 MCP 示例 JSON。该 JSON 是给支持环境变量替换的外部 MCP 客户端使用的示例。

## 托管训练版

使用 `pnpm install --frozen-lockfile` 和 `pnpm build` 构建。生成的 `dist/server/index.js` 内嵌网页，导出 Worker 风格的 `fetch(request, env)`，使用标准 Fetch / Web Crypto API。将其部署到支持此接口的平台，并通过平台的 secret 功能设置 `ARENA_TICKET_KEY`。可以在本机生成后直接填入平台，勿提交生成值：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

具体部署命令、域名、访问权限、限流和平台费用由部署者配置。仓库未绑定原开发者的站点 ID；若自行使用 Sites，只有提供自己的 `.openai/hosting.json` 时，构建才会复制该配置。普通 Worker 构建无需此文件。

托管入口只提供训练与访客自带 API，不接收开发者的 MCP Token 或共享模型密钥。未配置票据密钥时，策略训练仍可用，访客模型不可用。轮换票据密钥会使旧对局失效。

当前验收覆盖本机构建和 Worker 请求处理，不等于已经部署到你的域名。原私人预览未通过自动化线上联调，因此没有作为公开演示地址提供。
