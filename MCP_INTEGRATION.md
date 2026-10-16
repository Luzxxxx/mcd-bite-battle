# MCP 接入说明

## 实际使用的服务与价值

服务：麦当劳中国官方 MCP Server，`https://mcp.mcd.cn`，Streamable HTTP，Bearer 鉴权。Token 从本机 `MCD_MCP_TOKEN` 环境变量加载。项目客户端实现初始化、会话头、JSON/SSE 响应和只读工具白名单。

业务价值：让“你比 AI 会点吗”从虚构算价变为可核验的交互挑战。官方菜单决定当前可买什么，详情决定套餐真正包含什么，官方整单计价决定谁更便宜。前端加总与模型判断均不能替代官方核价。

参考：[官方 MCP 指南](https://github.com/M-China/mcd-mcp-server)、[本次比赛](https://github.com/M-China/mcd-developer-innovation-challenge)。具体工具 schema 来自本机鉴权后的 `tools/list`，不是从概括性 README 猜测。

## 工具使用情况

| Tool | 当前实际用途 | 触发位置 |
| --- | --- | --- |
| `query-nearby-stores` | 按城市与地点搜索、显示营业状态、选择即时自取门店 | 页面选店与本机探测脚本；不申请定位 |
| `query-meals` | 获取所选门店与就餐方式的菜单、菜单级商品及参考价 | 每次准备真实对局；验证脚本 |
| `query-meal-detail` | 获取套餐轮次、可选子项、份数、默认特制；建立单点映射 | 每次准备真实对局；每轮内存缓存 |
| `calculate-price` | 套餐、全单点、选定随心配，以及玩家/对手完整餐单的官方报价 | 准备、玩家组合对齐时、最终翻牌时 |

没有把 `query-store-coupons`、营养或时间查询做成当前产品能力。客户端虽预留部分只读工具，实际产品流程只用上表。没有领券、绑券、建单、付款、抽奖或积分操作。

## 实际请求链路

```text
本机 .env → Node MCP 客户端 → 官方服务
                          ↑
浏览器 → 本机 HTTP API → LiveArena

prepare: 查询菜单 → 套餐详情 → 默认子项/特制
       → 单点菜单级 SKU 映射 → 套餐/全单点官方报价
       → 提前选择并在服务器保存对手方案 → 返回题目和公开菜单

quote: 玩家选配 → 精确餐袋匹配 → 官方整单报价 → 校验计价商品回执
reveal: 服务器取原对手方案 → 双方分别重新整单核价 → 比较整数分
```

服务器将所选门店固定在本局上下文 `{storeCode:所选门店, orderType:1, beType:1}` 中。默认脚本保留历史测试门店 `1450713`；界面先按城市与地点搜索，只允许当前结果中确认营业的门店。当前不做预约，营业徽标不能代替实际菜单与计价成功。网页不接受调用者任意指定官方 Tool，也不从浏览器接收原始 MCP 请求。

`/api/live/menu` 返回所选门店的完整菜单与分类。`/api/live/prepare` 支持快捷题 `chicken`、`bigmac`、`fish`，以及从菜单开题的 `caseId: "menu"` 与 `mealCode`。后者可选单品或套餐，但只有默认选配能精确拆解、映射与核价时才可开局。`quote` 与 `reveal` 接收服务生成的 `roundId` 和选配计划。计划每项为 `{offerId,variantId,quantity}`，原始官方 SKU 与特制参数由服务器映射生成。对局保存在内存，约十五分钟失效，服务重启后需要重开。

## 价格与套餐的真实结构

菜单 `data.meals` 是商品编码到菜单条目的映射，`currentPrice` 是元字符串。详情中的 `rounds` 描述套餐轮次，`choices` 包含子项编码、`isDefault`、`quantity`、`diffPrice` 与特制。

官方 `calculate-price` 使用整数分。无券自取请求示意：

```json
{
  "storeCode": "1450713",
  "orderType": 1,
  "beType": 1,
  "needTableware": false,
  "items": [{
    "productCode": "9900008751",
    "quantity": 1,
    "roundList": [{
      "round": "1",
      "comboItemList": [{ "code": "3050", "quantity": 1 }]
    }]
  }]
}
```

这个例子只展示“菜单父商品 + 中杯选项”的结构；实际请求还必须携带实时详情要求的默认特制 `modification.values`。请通过实现生成请求，勿直接把示意 JSON 当成完整可用订单。

## 最重要的校验：接口成功不等于商品齐全

实测中，`3050` 是中杯可乐子项编码，直接把它当顶层 `productCode` 时，计价服务可能返回成功，但 `productList` 里漏掉饮料。只检查 HTTP 或 `success:true` 会得到错误的低价。

本项目使用官方菜单级“可乐”父商品 `9900008751`，明确选择 `3050` 子项；映射依据是官方声明的子项编码和默认特制签名。显示名称只用来缩小候选搜索范围，不能证明等价。

参与胜负的报价必须同时满足：

1. 两边展开后的叶子餐品编码、份数、规格和默认特制签名一致，无缺项、无多项。
2. 请求顶层商品的编码与数量，和返回 `productList` 的编码、数量完全对应；如果服务静默漏项，本局不判胜。
3. `structuredContent` 明确业务成功，`price` 是非负整数分，双方都能在预算内完成。
4. 使用同门店、同就餐方式、同一局允许的优惠条件；真实 MVP 目前不使用券。

当前 `productList` 校验覆盖顶层编码与份数；套餐内规格来自本次查询的官方详情及请求。若后续接口提供更细的回执明细，应再核对回执中的所有子项与特制。现阶段不宣称这些检查等同于实际履约确认。

## 对手与公平性

默认真实策略对手只比较两种完整合法买法：默认整套餐、全部单点。可选 DeepSeek 对手使用受限报价工具比较自己的候选，见 `docs/MODEL_INTEGRATION.md`。它在玩家开始前就确定方案，保存在本机服务器，不因玩家报价改变。准备阶段返回 SHA-256 承诺值；翻牌时取原方案并重新核价，同时返回 nonce。前端重算 `JSON.stringify({plan,couponId,nonce})` 的摘要，核对与开局承诺一致。客户端本地策略模式仍是浏览器选定方案，不具有服务器承诺机制；本机真实模式和大模型训练模式使用服务器承诺。

玩家仍可使用同一公开菜单里的“随心配 + 剩余单点”。“赢”表示比当前披露的有限策略更省，并不表示发现官方全局最低价。重开局会重新取菜单，最终翻牌会重新核价；两次报价并非原子锁价，价格或供应发生变化时以本次返回为准，不能证明可成交。

## Token 与失败处理

真实 Token 不进入 `dist/`、Git、分享卡或源码包；本项目的托管训练入口不使用 MCP Token。本机服务只绑定 `127.0.0.1`，检查 Host 和 Origin；错误文本进行 Token/Bearer 脱敏。MCP 工具客户端在网络请求前阻止交易类调用。

401、超时、门店时段缺货、详情无法映射、回执漏项或对手未核验成功时，显示原因并停止判胜，不能自动把失败解释为便宜或免费。线上静态试玩缺少 API 时，明确提示使用本机真实模式。

## 复现与证据

```powershell
node --env-file-if-exists=.env scripts/mcp-probe.mjs
node --env-file-if-exists=.env scripts/verify-live.mjs
node --env-file-if-exists=.env scripts/demo-live.mjs
```

探测与三套餐验证的原始数据只写入忽略目录 `work/live/`。脱敏后的固定样本、测试时间、价格与 trace 见 [docs/VERIFICATION.md](docs/VERIFICATION.md) 和 [docs/live-evidence.json](docs/live-evidence.json)。当前参赛包检查见 [docs/RELEASE_CHECK.md](docs/RELEASE_CHECK.md)。历史验证不能代替新对局的官方报价。

根目录 [mcp-config.example.json](mcp-config.example.json) 仅含 `MCD_MCP_TOKEN` 环境变量占位符，供支持变量替换的外部 MCP 客户端参考；Node 服务直接读取环境变量，不加载该 JSON。
